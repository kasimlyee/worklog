# 02 — Architecture

Status: **Approved for build** · Applies to all phases

This document defines *how* Worklog is built. Product behaviour is in `01-product-spec.md`; rule IDs (`BR-xx`, `R-xx`, `NF-xx`) refer to it.

---

## 1. Overview

```
Browser ──HTTPS──▶ Netlify (Next.js 16, Node runtime)
                     │
                     ├─ proxy.ts ............ CSP nonce, optimistic auth redirect
                     ├─ app/ (routes) ....... Server Components, Server Actions, Route Handlers
                     │      │
                     │      ▼
                     ├─ server/services ..... validation, business rules, orchestration
                     │      │          │
                     │      ▼          ▼
                     ├─ server/repositories   server/github ──HTTPS──▶ api.github.com
                     │      │
                     │      ▼
                     └─ server/db (Kysely + pg) ──TLS──▶ Neon Postgres (pooled endpoint)
```

- One deployable. No separate API server, no client-side data layer.
- **Reads** happen in Server Components calling services directly.
- **Writes** happen through Server Actions calling services.
- **Route Handlers** exist only where a raw HTTP response is required: OAuth redirects/callback and report file downloads.

## 2. Dependency policy

A dependency is added only when **all** of these hold:

1. Writing it ourselves would be large, risky, or security-sensitive.
2. It is actively used in production code or the test strategy — not "might be handy".
3. It has no native or platform alternative (Node, Web APIs, Postgres, Next.js itself).
4. It is recorded in the table below with its reason. A PR adding a dependency without updating this table is rejected.

### 2.1 Runtime dependencies (complete list)

| Package | Why it is needed | Rejected alternatives |
|---|---|---|
| `next`, `react`, `react-dom` | The framework. | — |
| `kysely` | Type-safe SQL that stays SQL. Migrations built in. | Prisma, Drizzle (full ORMs, codegen, heavier runtime) |
| `pg` | Postgres driver used by Kysely's built-in `PostgresDialect`. Works with Neon's pooled endpoint from Netlify's Node runtime. | `@neondatabase/serverless` (only needed for edge runtimes) |
| `zod` | Validating untrusted input at trust boundaries (forms, GitHub API responses, env). Types are inferred, so rules are written once. | Hand-written validators (more code, more security risk) |
| `markdown-it` | Rendering notes. With `html: false` it escapes raw HTML and blocks `javascript:` links **without a separate sanitiser**. | `marked` (needs a sanitiser + DOM), `react-markdown` (large dependency tree) |
| `pdf-lib` | PDF generation in pure JavaScript; no native binaries, no headless browser. Works inside Netlify functions. We only *write* PDFs from our own data, never parse untrusted ones. | Puppeteer/Chromium (too heavy for functions), `pdfkit` (font-file bundling issues on serverless) |
| `server-only` | Build-time guarantee that server modules (secrets, DB) can never be bundled for the browser. | — |

Not dependencies, on purpose: date libraries (use `Intl` + our own small calendar module), OAuth libraries (one small, well-tested flow), GitHub SDK (one `fetch` call), UI component libraries, lodash-style utilities, state managers.

### 2.2 Development dependencies (complete list)

| Package | Why |
|---|---|
| `typescript` (6.0.x) | Compiler. Pinned to 6.0 because `typescript-eslint` does not yet support TypeScript 7. Upgrade together later. |
| `@types/node`, `@types/react`, `@types/react-dom`, `@types/pg`, `@types/markdown-it` | Types for the above. |
| `eslint`, `typescript-eslint` | The only way to **forbid `any`** and enforce type-aware rules — the compiler alone cannot. |
| `@next/eslint-plugin-next`, `eslint-plugin-react-hooks` | Framework and hooks correctness rules. |
| `vitest`, `vite`, `@vitest/coverage-v8` | Test runner and coverage. |
| `@testing-library/react`, `@testing-library/user-event`, `jsdom` | Component tests (Phase 2). |
| `@playwright/test` | End-to-end tests (Phase 3–4). |
| `@axe-core/playwright` | Automated accessibility checks (Phase 4). |
| `fast-check` | Property-based tests for calendar and report logic (Phase 4). |

TypeScript scripts (migrations, seeding) run with **Node's built-in type stripping** — no `tsx`/`ts-node`.

## 3. Repository layout

```
.
├── docs/                         Specifications (this folder)
├── scripts/
│   └── migrate.ts                Runs Kysely migrations (node scripts/migrate.ts)
├── src/
│   ├── proxy.ts                  CSP nonce + cookie-presence redirect (NOT the auth boundary)
│   ├── app/                      Next.js routes — thin adapters only
│   │   ├── sign-in/page.tsx
│   │   ├── auth/github/route.ts            OAuth start
│   │   ├── auth/github/callback/route.ts   OAuth callback
│   │   ├── people/…
│   │   └── projects/
│   │       ├── page.tsx                    Project switcher
│   │       └── [projectId]/
│   │           ├── layout.tsx              Session + project check, nav
│   │           ├── page.tsx                Dashboard
│   │           ├── plans/ log/ issues/ releases/ notes/ settings/
│   │           └── reports/
│   │               ├── page.tsx            Preview
│   │               └── export/route.ts     PDF / Markdown download
│   ├── server/                   BACKEND — every module imports 'server-only'
│   │   ├── env.ts                Validated configuration (fails fast)
│   │   ├── db/
│   │   │   ├── client.ts         Kysely instance, pg pool, type parsers
│   │   │   ├── types.ts          Hand-written Database interface
│   │   │   ├── migrator.ts
│   │   │   └── migrations/       0001_initial.ts, …
│   │   ├── domain/               PURE logic: no I/O, no Next, no React, no DB
│   │   │   ├── calendar.ts       IsoDate, today(), working days, periods
│   │   │   ├── deadlines.ts      Overdue / due-soon / issue deadline state
│   │   │   ├── pull-request-url.ts
│   │   │   └── …
│   │   ├── repositories/         Kysely queries only; no business rules
│   │   ├── services/             Validation + rules + orchestration; return Result
│   │   ├── log.ts                Structured logger (the only module allowed to use console)
│   │   ├── auth/                 Sessions, OAuth flow; next-session.ts is the Next.js adapter
│   │   ├── github/               PR fetch client
│   │   ├── reports/              load → build (pure) → render (markdown, pdf)
│   │   └── actions/              'use server' Server Actions (Phase 3)
│   ├── ui/                       FRONTEND
│   │   ├── components/           Presentational, props-only; no data fetching
│   │   ├── view-models/          Types the components accept — the Phase 2/3 contract
│   │   ├── fixtures/             Example view-models for tests and development
│   │   └── styles/               tokens.css (colour tokens) and global.css (Tailwind theme, base elements)
│   └── lib/                      Tiny shared pure helpers (Result, brand) — safe on both sides
└── tests/
    ├── setup/                    Test database lifecycle
    ├── e2e/                      Playwright
    └── fixtures/                 Builders for test data
```

### 3.1 Imports

- **Subpath imports, not tsconfig `paths`.** `package.json` declares `"#src/*": "./src/*"`. Node, TypeScript, Next.js and Vitest all understand this natively, so scripts run by plain Node resolve the same way as the app.
- **Explicit file extensions** on every relative and `#src` import (`./calendar.ts`). This is what lets Node run TypeScript directly.
- **Relative imports only within one folder.** Anything else goes through `#src/…`, so the layer rules below can be checked by path.
- **Scripts run with `node --conditions=react-server`**, so modules that import `server-only` load outside Next.js (the `db:migrate` script already does this). Vitest replaces `server-only` with an empty stub.

### 3.2 Layer rules (enforced by ESLint `no-restricted-imports`)

| Layer | May import | Must not import |
|---|---|---|
| `server/domain` | `lib` | anything with I/O: `db`, `repositories`, `services`, `next/*`, `react` |
| `server/repositories` | `db`, `domain`, `lib` | `services`, `next/*`, `react` |
| `server/services` | `repositories`, `domain`, `github`, `lib` | `next/*`, `react`, `app`, `ui` |
| `server/reports` | `repositories`, `domain`, `lib` | `next/*`, `app` |
| `server/auth` | `repositories`, `domain`, `lib` | `next/*` — except `auth/next-session.ts`, the one adapter that reads cookies and redirects |
| `server/actions` | `services`, `auth`, `lib`, `next/cache`, `next/navigation` | `repositories`, `db` directly |
| `ui/components` | `ui`, `lib` | anything under `server` |
| `app` | everything | — (but holds no logic) |

Services know nothing about HTTP or Next.js. That keeps them fully testable in Phase 1 without a running app.

## 4. Data and errors

### 4.1 Branded primitives
Values with rules get branded types so they cannot be mixed up or forged by accident:

- `IsoDate` — a validated `YYYY-MM-DD` calendar date string.
- `ProjectId`, `PersonId`, `EntryId`, … — UUID strings per entity.

Brands are created only in one constructor per type, which validates. The constructor is the single place a type assertion is allowed (see standards §4).

### 4.2 Results, not exceptions, for expected failures

```ts
type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
```

- Services return `Result` for anything a user can cause: validation failure, not found, GitHub unreachable, rule violation (e.g. `BR-11`).
- Errors are discriminated unions with a `code`, handled with exhaustive `switch`.
- **Exceptions are only for bugs and infrastructure failures** (database down). They are caught once at the adapter layer, logged, and shown as a generic error page.

## 5. Database

### 5.1 Connection
- Kysely with `PostgresDialect` over a `pg` `Pool`, created once per function instance (module scope), `max: 3`, short idle timeout.
- `DATABASE_URL` points to Neon's **pooled** endpoint (PgBouncer). Migrations use `DATABASE_URL_DIRECT` (non-pooled).
- `CamelCasePlugin`: snake_case in SQL, camelCase in TypeScript.
- **Type parsers:** Postgres `date` (OID 1082) must be returned as the raw `YYYY-MM-DD` string. The pg default converts it to a JavaScript `Date` at local midnight, which shifts dates across time zones. This is a correctness requirement with its own test.

### 5.2 Rules
- Only Kysely's builder or its `sql` template tag (which parameterises). `sql.raw` with any non-constant value is forbidden.
- **Integrity in the database, not only in code.** Every cross-table "belongs to the same project" rule (`BR-19`) is enforced with composite foreign keys on `(id, project_id)`.
- Archive columns, not deletes, for projects, areas and people (`BR-06`).
- `updated_at` is set by repositories, not triggers.
- `Database` types in `db/types.ts` are hand-written. An integration test compares them against `information_schema` so they can never drift from migrations.

### 5.3 Schema (migration `0001_initial`)

```sql
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
```

`ON DELETE SET NULL (column)` requires Postgres 15+. Neon's current versions satisfy this.

## 6. Time and dates

The single most likely source of subtle bugs. Rules:

1. Business dates are `IsoDate` strings end to end: Postgres `date` → string (type parser) → domain → UI. They are **never** converted to `Date` objects except inside `calendar.ts`.
2. `today()` takes the clock and time zone as parameters: `today(now: Date, timeZone: string): IsoDate`, implemented with `Intl.DateTimeFormat(…).formatToParts`. Callers pass `new Date()` and `env.APP_TIME_ZONE`; tests pass fixed values. No hidden global clock.
3. Date arithmetic (add days, weekday, next working day, week start, month start/end, days between) is done in UTC on the date parts, so DST and server zone cannot affect it.
4. `timestamptz` columns (`created_at`, `moved_at`) are audit data only; they never decide business logic.

## 7. Authentication

Single user, GitHub OAuth (an OAuth App owned by Kasim), no third-party auth library.

**Sign in**
1. `GET /auth/github` creates a 32-byte random `state`, stores it in cookie `__Host-oauth_state` (HttpOnly, Secure, SameSite=Lax, Path=/, 10 minutes) and redirects to GitHub's authorize URL with `client_id`, `redirect_uri` (`{APP_URL}/auth/github/callback`), `state`, no scopes, `allow_signup=false`.
2. `GET /auth/github/callback` compares `state` with the cookie using `crypto.timingSafeEqual`, then deletes the cookie. Mismatch → 400.
3. Exchanges `code` for an access token, calls `GET https://api.github.com/user`, validates the response with zod.
4. If the numeric GitHub **user id** (immutable; logins can be renamed) is not `ALLOWED_GITHUB_USER_ID` → 403 page. No session.
5. Otherwise: create a 32-byte random session token, store its **SHA-256 hash** with an expiry of 30 days, set cookie `__Host-session` (HttpOnly, Secure, SameSite=Lax, Path=/). The GitHub access token is discarded — never stored.
6. Delete expired session rows (cheap, no cron).

**Every request**
- The session service works on a plain token string, so it is testable without Next.js. `requireSession()` in `auth/next-session.ts` is the thin adapter: it reads the cookie, calls the service (hash, look up a non-expired row), and redirects to `/sign-in` otherwise.
- It is called in **every** layout/page, Server Action and Route Handler. `proxy.ts` only does a cookie-presence redirect for speed — it is never trusted as the security boundary.

**Sign out** is a Server Action (POST) that deletes the row and clears the cookie.

## 8. GitHub pull requests

- Parse with `parsePullRequestUrl(input): Result<PrRef, PrUrlError>` — strict pattern from `BR-21`, owner checked against `GITHUB_ALLOWED_ORGS` (`BR-22`).
- Fetch `GET https://api.github.com/repos/{owner}/{repo}/pulls/{number}` with:
  - `Authorization: Bearer {GITHUB_PR_TOKEN}` (fine-grained token, organisation as resource owner, read-only *Pull requests* permission),
  - `Accept: application/vnd.github+json`, a pinned `X-GitHub-Api-Version`,
  - `AbortSignal.timeout(5000)`.
- Validate the response with zod. State is `merged` if `merged_at` is set, otherwise `open`/`closed`.
- Map failures to typed errors: `not_found_or_no_access` (404), `unauthorized` (401), `rate_limited` / `forbidden` (403/429), `timeout`, `network`, `invalid_response`. `BR-26`: no record is written on failure.
- The token is read only from `server/env.ts`; the client module imports `server-only`.

Before building: confirm the organisation allows fine-grained tokens, and approve the token if approval is required.

## 9. Reports pipeline

```
ReportRequest ──▶ load (repositories, fixed queries) ──▶ ReportData
                                                            │
                                     build (pure, domain) ◀─┘
                                                │
                                           ReportModel ──▶ render: preview (React)
                                                         ├─▶ render: Markdown (string)
                                                         └─▶ render: PDF (Uint8Array)
```

- **`ReportRequest`**: project, kind, period start. Validated: weekly must start Monday, monthly the 1st.
- **Load**: a fixed number of queries per kind regardless of data size (`NF-02`). Nested lists (people per entry, PRs per release) come from Kysely's `jsonArrayFrom` helper in the same query — never a query per row.
- **Build**: a pure function `buildReportModel(data, today)` that applies `R-01`…`R-10` and the kind-specific sections. Nearly all report logic is tested here, without a database.
- **Render**: each renderer is a pure function of `ReportModel` (`R-02`). Markdown and PDF output are snapshot-tested.
- **PDF**: `pdf-lib` standard fonts (Helvetica). Characters outside the font's WinAnsi set are replaced with a fallback character by a tested sanitiser rather than crashing. A4, margins, text wrapping and page breaks are handled by a small layout module that is unit-tested on its own.
- **Download**: `GET /projects/{projectId}/reports/export?kind=weekly&start=2026-11-09&format=pdf|md` → session check → validate → load → build → render → `Content-Disposition: attachment`, `Cache-Control: no-store`.

## 10. Frontend

- **Server Components by default.** A component becomes a Client Component only for interaction that needs browser JavaScript (quick-log keyboard handling, reorder, confirmation dialogs). Target: the dashboard ships no page-specific client JavaScript.
- **Forms** are plain `<form action={serverAction}>` with `useActionState` for errors, so they work before hydration.
- **Presentational components** in `ui/components` take **view-model props only** and never fetch. View-model types in `ui/view-models` are the contract between Phase 2 (built against fixtures) and Phase 3 (mapped from services).
- **Styling:** Tailwind CSS v4 (a build-time PostCSS plugin; it ships one static stylesheet, so the CSP is unchanged). `tokens.css` defines the colours, light and dark (including the four status tokens); `global.css` maps them onto Tailwind's theme — the default palette is switched off, so components can only use token colours (`bg-surface`, `text-muted`, `border-line`) — and styles the base elements (buttons, inputs, tables). Components use utility classes; class lists shared by several screens live in `ui/components/lists.ts`. No UI component library. Respect `prefers-color-scheme` and `prefers-reduced-motion`.
- **Status display:** one `StatusTag` component used everywhere, always colour + text (product spec §5).

## 11. Security model

| Threat | Control |
|---|---|
| Anyone else signing in | GitHub user-id allow-list; session check in every adapter (§7) |
| Session theft | Opaque random token, hashed at rest, `__Host-` HttpOnly Secure cookie, 30-day expiry, sign-out deletes server-side |
| CSRF | SameSite=Lax cookies; Server Actions are POST with Next.js origin checks; OAuth `state`; all GET handlers are read-only |
| XSS | React escaping; markdown-it `html: false`; strict nonce-based CSP from `proxy.ts`; no `dangerouslySetInnerHTML` except the markdown renderer output |
| SQL injection | Kysely parameterisation; `sql.raw` banned for non-constants |
| Secret leakage | Secrets only in `server/env.ts`; `server-only` on every server module; never logged; no `NEXT_PUBLIC_` secrets |
| Untrusted external data | zod validation of every GitHub response and every form input |
| Open redirects | Post-sign-in redirect only to same-origin relative paths |
| Malicious links | `https?://` only (DB checks + validation), `rel="noopener noreferrer"`, `target="_blank"` |
| Clickjacking | `frame-ancestors 'none'` |
| Data loss | Archive instead of delete for referenced entities; Neon point-in-time restore |

Headers: CSP (nonce, `default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`), HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`. Static headers live in `next.config.ts`; the CSP with its nonce is set in `proxy.ts`.

## 12. Configuration

All configuration is environment variables, parsed once with zod in `server/env.ts`. A missing or invalid value stops the app at startup with a clear message.

| Variable | Example | Notes |
|---|---|---|
| `APP_URL` | `https://worklog.example.com` | Used for OAuth redirect URI |
| `APP_TIME_ZONE` | `Africa/Kampala` | Validated as a real IANA zone |
| `DATABASE_URL` | Neon pooled URL | App runtime |
| `DATABASE_URL_DIRECT` | Neon direct URL | Migrations only |
| `GITHUB_OAUTH_CLIENT_ID` / `_SECRET` | | OAuth App credentials |
| `ALLOWED_GITHUB_USER_ID` | `1234567` | Numeric id, not the login |
| `GITHUB_PR_TOKEN` | `github_pat_…` | Fine-grained, read-only pull requests |
| `GITHUB_ALLOWED_ORGS` | `suds-tech` | Comma-separated |
| `GITHUB_API_URL` | `https://api.github.com` | Optional, defaults to GitHub. Must be `https://`, or `http://localhost:{port}` for the E2E fake. Never set in production. |
| `REPORT_AUTHOR_NAME` | `Kasim …` | Shown on reports |

## 13. Performance

- Server rendering, dynamic per request (personal data — no shared caching).
- Neon and Netlify functions in the **same region**; this matters more than any code optimisation.
- Indexes in §5.3 cover the dashboard and every report range query. Phase 4 checks plans with `EXPLAIN`.
- Query budget per page is asserted in integration tests (count queries via a Kysely `log` hook).
- Long lists (log, issues) are paginated by keyset (`work_date, id`), not `OFFSET`.

## 14. Logging

- Structured one-line JSON to stdout (Netlify collects it): level, event, duration, error code.
- Never log secrets, tokens, cookies, or full request bodies.

## 15. Implementation decisions

Recorded during the build. Each one either fills a gap in the specs or adjusts a detail that did not survive contact with the real platform.

| # | Decision | Why |
|---|---|---|
| D-1 | **Cookies on http://localhost are `worklog_session` / `worklog_oauth_state`, without `Secure`.** On https they are always `__Host-session` / `__Host-oauth_state` with `Secure`. `APP_URL` may only be plain http for `localhost` / `127.0.0.1` (validated in `env.ts`). | Safari refuses `Secure` cookies on http://localhost, which broke local use and WebKit E2E. Production cannot be configured insecurely. |
| D-2 | **CSP `upgrade-insecure-requests` only when `APP_URL` is https.** | On http://localhost Safari upgrades the app's own CSS/JS to https and the page loads unstyled. |
| D-3 | **Migration `0002`: `plan_items_completed_idx ON plan_items (project_id, completed_on) WHERE completed_on IS NOT NULL`.** Report queries test `status <> 'done'` / `status <> 'resolved'` (equivalent to the `IS NULL` forms by the CHECK constraints) so the partial indexes apply. | The Phase 4 `EXPLAIN` suite found report queries that no index could serve. |
| D-4 | **BR-14 grace period:** a due date already passed but not yet overdue (due Friday, seen at the weekend) counts as *due soon*, labelled "Due yesterday" / "Was due 2 days ago". | Read literally, BR-14 leaves those items neither overdue nor due soon, and "on track" would be wrong. |
| D-5 | **Note headings start at h3** (`# x` renders as `<h3>`). | A note's `#` heading otherwise became a second `<h1>` on the page (WCAG 1.3.1). |
| D-6 | **U+0000 is removed from text input.** | Postgres cannot store it; a paste containing it caused a 500. |
| D-7 | **Branded ids:** only `IsoDate` is branded. Entity ids are plain UUID strings, validated at every service boundary (`isUuid`) and always queried together with the project id. | Brands on every id added casts in every repository without catching anything the project-scoped queries and composite foreign keys do not already catch. |
| D-8 | **Extra folders:** `server/http/` (framework-free Request→Response handlers: report export), `server/mappers/` (service output → view-models), `server/app-context.ts` (today, GitHub client, database handle for adapters), `app/_lib/loaders.ts` (project check and pickers, cached per request). Lint layer rules cover `server/http`. Server Actions may import `ui/view-models` types (their `FormState` contract) but not UI components. | Keeps `app/` and actions thin, as §3 intends. |
| D-9 | **Pull requests screen** at `/projects/{id}/pull-requests` (add by link, refresh, delete when unused). | BR-24 (refresh) and BR-36 (delete PR) need a place in the UI that §6 did not name. |
| D-10 | **Tailwind CSS replaces CSS Modules** (supersedes the generated CSS-module types). | One design language in the markup, colours limited to the tokens by the theme, and no generated `*.d.css.ts` files to keep in step. Costs two build-time dependencies (`tailwindcss`, `@tailwindcss/postcss`); nothing is added to the browser bundle. |
| D-11 | **The weekly report loads Monday–Sunday**; weekend entries appear only if they exist and are labelled "weekend work". Releases and resolved issues use the same range. | Product spec §7.3. |
| D-16 | **Entry links are many-to-many (BR-17)**: migration `0005` adds `entry_issues` and `entry_plan_items` (composite FKs on `(id, project_id)`, cascading when the issue, plan item or entry is deleted) and copies existing links. The old `entries.plan_item_id` / `issue_id` columns are kept for rollback, written as NULL, and can be dropped by a later migration. | A PR often carries several fixes. |
| D-15 | **Perceived speed.** (a) Every project page's frame (form options + overdue count) is one query (`loadProjectChrome`); session, project and frame load in parallel, so a page waits ~2 round trips, not 6–7. (b) The pool keeps up to 8 connections for 5 minutes (`keepAlive`), so clicks reuse a warm TLS connection. (c) `staleTimes.dynamic = 30`: revisited pages show instantly; every write's `revalidatePath` clears it. (d) A progress bar shows the instant a link is clicked; one-click buttons say "Saving…"; status menus save on change. Loading skeletons (`loading.tsx`) were rejected: they hide content when JavaScript is off (NF-04). | Users found clicks slow. Measured on production: one query adds ~250 ms because Netlify functions and Neon were in different regions — see docs/06 §1. |
| D-14 | **Issue description (BR-27)**: migration `0004` adds `issues.description text NOT NULL DEFAULT ''` with a 2,000-character CHECK. Plain text, shown with its line breaks — not Markdown, so it stays a short reminder. | Added after launch at the user's request; the non-goal in product spec §2 was narrowed to *copying* full descriptions. |
| D-13 | **Issue priority (BR-37)** is a column added by migration `0003` (`issue_priority` enum, default `medium`). No index: the dashboard already loads all open issues of a project in one query. | Added after launch at the user's request. |
| D-12 | **"Still open and overdue" in a report is judged at the period end** (or today, if earlier), so a past report does not change when later work is done. | Reports are generated on demand, often after the period. |
