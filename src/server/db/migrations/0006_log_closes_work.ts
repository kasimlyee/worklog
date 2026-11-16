import { sql, type Kysely } from 'kysely';

/*
 * BR-44…BR-46: a log closes work. Each issue linked to an entry carries a short
 * Issue / Cause / Fix summary and whether this entry fixes it; each linked plan item
 * whether this entry finishes it. An entry can carry several pull requests (FE + BE).
 * Additive: the old entries.pull_request_id column stays, unused, for rollback.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
ALTER TABLE entry_issues
  ADD COLUMN IF NOT EXISTS summary text NOT NULL DEFAULT '' CHECK (length(summary) <= 1000),
  ADD COLUMN IF NOT EXISTS cause text NOT NULL DEFAULT '' CHECK (length(cause) <= 1000),
  ADD COLUMN IF NOT EXISTS fix text NOT NULL DEFAULT '' CHECK (length(fix) <= 1000),
  ADD COLUMN IF NOT EXISTS resolves boolean NOT NULL DEFAULT false;

ALTER TABLE entry_plan_items
  ADD COLUMN IF NOT EXISTS completes boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS entry_pull_requests (
  project_id       uuid NOT NULL,
  entry_id         uuid NOT NULL,
  pull_request_id  uuid NOT NULL,
  PRIMARY KEY (entry_id, pull_request_id),
  FOREIGN KEY (entry_id, project_id) REFERENCES entries (id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (pull_request_id, project_id) REFERENCES pull_requests (id, project_id)
);
CREATE INDEX IF NOT EXISTS entry_pull_requests_pull_request_idx ON entry_pull_requests (pull_request_id);

INSERT INTO entry_pull_requests (project_id, entry_id, pull_request_id)
  SELECT project_id, id, pull_request_id FROM entries WHERE pull_request_id IS NOT NULL
  ON CONFLICT DO NOTHING;
`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
DROP TABLE IF EXISTS entry_pull_requests;
ALTER TABLE entry_plan_items DROP COLUMN IF EXISTS completes;
ALTER TABLE entry_issues DROP COLUMN IF EXISTS summary, DROP COLUMN IF EXISTS cause, DROP COLUMN IF EXISTS fix, DROP COLUMN IF EXISTS resolves;
`.execute(db);
}
