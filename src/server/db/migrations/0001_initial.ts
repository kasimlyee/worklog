import { sql, type Kysely } from 'kysely';

// docs/02-architecture.md §5.3. Constant SQL only: the template has no parameters.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
CREATE TYPE plan_horizon     AS ENUM ('day', 'week', 'month');
CREATE TYPE plan_item_status AS ENUM ('planned', 'in_progress', 'done', 'blocked');
CREATE TYPE issue_status     AS ENUM ('open', 'in_progress', 'resolved');
CREATE TYPE pr_state         AS ENUM ('open', 'closed', 'merged');
CREATE TYPE release_status   AS ENUM ('planned', 'released');
CREATE TYPE report_kind      AS ENUM ('daily', 'weekly', 'monthly');

-- Auth -------------------------------------------------------------------
CREATE TABLE sessions (
  token_hash      bytea PRIMARY KEY,                 -- SHA-256 of the cookie token
  github_user_id  bigint      NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  CHECK (expires_at > created_at)
);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

-- Projects, areas, people ------------------------------------------------
CREATE TABLE projects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 60),
  name         text NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 120),
  description  text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  archived_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE areas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects (id),
  name         text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  position     integer NOT NULL CHECK (position >= 0),
  archived_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name),
  UNIQUE (project_id, position) DEFERRABLE INITIALLY DEFERRED,   -- reorder in one transaction
  UNIQUE (id, project_id)
);

CREATE TABLE people (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 80),
  archived_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Pull requests ----------------------------------------------------------
CREATE TABLE pull_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects (id),
  owner        text NOT NULL CHECK (owner ~ '^[A-Za-z0-9-]{1,39}$'),
  repo         text NOT NULL CHECK (repo  ~ '^[A-Za-z0-9._-]{1,100}$'),
  number       integer NOT NULL CHECK (number > 0),
  title        text NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
  state        pr_state NOT NULL,
  fetched_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, owner, repo, number),
  UNIQUE (id, project_id)
);
-- The URL is derived (https://github.com/{owner}/{repo}/pull/{number}), never stored.

-- Issues -----------------------------------------------------------------
CREATE TABLE issues (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         uuid NOT NULL REFERENCES projects (id),
  area_id            uuid,
  resolved_by_pr_id  uuid,
  title              text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  external_url       text CHECK (external_url ~ '^https?://' AND length(external_url) <= 2000),
  status             issue_status NOT NULL DEFAULT 'open',
  assigned_on        date NOT NULL,
  deadline           date NOT NULL,
  resolved_on        date,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (deadline >= assigned_on),                                -- BR-28
  CHECK ((status = 'resolved') = (resolved_on IS NOT NULL)),      -- BR-29
  UNIQUE (id, project_id),
  FOREIGN KEY (area_id, project_id)           REFERENCES areas (id, project_id),
  FOREIGN KEY (resolved_by_pr_id, project_id) REFERENCES pull_requests (id, project_id)
);

CREATE TABLE issue_assignees (
  issue_id   uuid NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  person_id  uuid NOT NULL REFERENCES people (id),
  PRIMARY KEY (issue_id, person_id)
);

-- Plans ------------------------------------------------------------------
CREATE TABLE plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects (id),
  horizon       plan_horizon NOT NULL,
  period_start  date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, horizon, period_start),                     -- BR-09
  UNIQUE (id, project_id),
  CHECK (                                                         -- BR-08
       (horizon = 'day'   AND extract(isodow FROM period_start) BETWEEN 1 AND 5)
    OR (horizon = 'week'  AND extract(isodow FROM period_start) = 1)
    OR (horizon = 'month' AND extract(day    FROM period_start) = 1)
  )
);

CREATE TABLE plan_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL,
  plan_id       uuid NOT NULL,
  area_id       uuid,
  issue_id      uuid,
  title         text NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  status        plan_item_status NOT NULL DEFAULT 'planned',
  due_date      date NOT NULL,
  completed_on  date,
  position      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'done') = (completed_on IS NOT NULL)),         -- BR-16
  UNIQUE (id, project_id),
  FOREIGN KEY (plan_id, project_id)  REFERENCES plans (id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (area_id, project_id)  REFERENCES areas (id, project_id),
  FOREIGN KEY (issue_id, project_id) REFERENCES issues (id, project_id) ON DELETE SET NULL (issue_id)
);
-- BR-11 (due date inside plan period) is enforced in the service: it needs the plan's horizon.

CREATE TABLE plan_item_assignees (
  plan_item_id  uuid NOT NULL REFERENCES plan_items (id) ON DELETE CASCADE,
  person_id     uuid NOT NULL REFERENCES people (id),
  PRIMARY KEY (plan_item_id, person_id)
);

CREATE TABLE plan_item_moves (                                    -- BR-15 history
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_item_id  uuid NOT NULL REFERENCES plan_items (id) ON DELETE CASCADE,
  from_plan_id  uuid NOT NULL REFERENCES plans (id),
  to_plan_id    uuid NOT NULL REFERENCES plans (id),
  from_due      date NOT NULL,
  to_due        date NOT NULL,
  moved_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (from_due <> to_due)
);

-- Entries ----------------------------------------------------------------
CREATE TABLE entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES projects (id),
  work_date        date NOT NULL,
  description      text NOT NULL CHECK (length(description) BETWEEN 1 AND 2000),
  area_id          uuid,
  pull_request_id  uuid,
  plan_item_id     uuid,
  issue_id         uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (area_id, project_id)          REFERENCES areas (id, project_id),
  FOREIGN KEY (pull_request_id, project_id)  REFERENCES pull_requests (id, project_id),   -- BR-36: restrict
  FOREIGN KEY (plan_item_id, project_id)     REFERENCES plan_items (id, project_id) ON DELETE SET NULL (plan_item_id),
  FOREIGN KEY (issue_id, project_id)         REFERENCES issues (id, project_id)     ON DELETE SET NULL (issue_id)
);

CREATE TABLE entry_people (
  entry_id   uuid NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
  person_id  uuid NOT NULL REFERENCES people (id),
  PRIMARY KEY (entry_id, person_id)
);

-- Releases and notes -----------------------------------------------------
CREATE TABLE releases (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects (id),
  version      text NOT NULL CHECK (length(version) BETWEEN 1 AND 50),
  status       release_status NOT NULL DEFAULT 'planned',
  target_date  date,
  released_on  date,
  notes        text NOT NULL DEFAULT '' CHECK (length(notes) <= 20000),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'released') = (released_on IS NOT NULL)),      -- BR-32
  UNIQUE (project_id, version),
  UNIQUE (id, project_id)
);

CREATE TABLE release_pull_requests (
  project_id       uuid NOT NULL,
  release_id       uuid NOT NULL,
  pull_request_id  uuid NOT NULL,
  PRIMARY KEY (release_id, pull_request_id),
  FOREIGN KEY (release_id, project_id)      REFERENCES releases (id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (pull_request_id, project_id) REFERENCES pull_requests (id, project_id)
);

CREATE TABLE notes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES projects (id),
  release_id       uuid,
  pull_request_id  uuid,
  title            text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  body             text NOT NULL DEFAULT '' CHECK (length(body) <= 50000),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (release_id, project_id)      REFERENCES releases (id, project_id)      ON DELETE SET NULL (release_id),
  FOREIGN KEY (pull_request_id, project_id) REFERENCES pull_requests (id, project_id)
);

CREATE TABLE note_links (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id   uuid NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
  label     text NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  url       text NOT NULL CHECK (url ~ '^https?://' AND length(url) <= 2000),   -- BR-34
  position  integer NOT NULL DEFAULT 0
);

CREATE TABLE report_notes (
  project_id    uuid NOT NULL REFERENCES projects (id),
  kind          report_kind NOT NULL,
  period_start  date NOT NULL,
  body          text NOT NULL CHECK (length(body) <= 5000),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, kind, period_start)
);

-- Indexes for the hot paths (dashboard + reports) -------------------------
CREATE INDEX entries_project_date_idx        ON entries (project_id, work_date);
CREATE INDEX entries_pull_request_idx        ON entries (pull_request_id) WHERE pull_request_id IS NOT NULL;
CREATE INDEX entry_people_person_idx         ON entry_people (person_id);
CREATE INDEX plan_items_open_due_idx         ON plan_items (project_id, due_date) WHERE status <> 'done';
CREATE INDEX plan_items_plan_idx             ON plan_items (plan_id, position);
CREATE INDEX issues_open_deadline_idx        ON issues (project_id, deadline) WHERE status <> 'resolved';
CREATE INDEX issues_resolved_idx             ON issues (project_id, resolved_on) WHERE resolved_on IS NOT NULL;
CREATE INDEX releases_project_released_idx   ON releases (project_id, released_on);
CREATE INDEX plan_item_moves_item_idx        ON plan_item_moves (plan_item_id, moved_at);
`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
DROP TABLE report_notes, note_links, notes, release_pull_requests, releases, entry_people, entries,
  plan_item_moves, plan_item_assignees, plan_items, plans, issue_assignees, issues, pull_requests,
  people, areas, projects, sessions;
DROP TYPE plan_horizon, plan_item_status, issue_status, pr_state, release_status, report_kind;
`.execute(db);
}
