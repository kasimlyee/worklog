import { sql, type Kysely } from 'kysely';

/*
 * BR-17: an entry may relate to several issues and fulfil several plan items (one PR often
 * carries more than one fix). Additive: the old single-link columns stay, unused, so an
 * older build still runs; existing links are copied across.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
DO $$ BEGIN
  ALTER TABLE entries ADD CONSTRAINT entries_id_project_id_key UNIQUE (id, project_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS entry_issues (
  project_id  uuid NOT NULL,
  entry_id    uuid NOT NULL,
  issue_id    uuid NOT NULL,
  PRIMARY KEY (entry_id, issue_id),
  FOREIGN KEY (entry_id, project_id) REFERENCES entries (id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (issue_id, project_id) REFERENCES issues (id, project_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS entry_issues_issue_idx ON entry_issues (issue_id);

CREATE TABLE IF NOT EXISTS entry_plan_items (
  project_id    uuid NOT NULL,
  entry_id      uuid NOT NULL,
  plan_item_id  uuid NOT NULL,
  PRIMARY KEY (entry_id, plan_item_id),
  FOREIGN KEY (entry_id, project_id) REFERENCES entries (id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (plan_item_id, project_id) REFERENCES plan_items (id, project_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS entry_plan_items_plan_item_idx ON entry_plan_items (plan_item_id);

INSERT INTO entry_issues (project_id, entry_id, issue_id)
  SELECT project_id, id, issue_id FROM entries WHERE issue_id IS NOT NULL
  ON CONFLICT DO NOTHING;
INSERT INTO entry_plan_items (project_id, entry_id, plan_item_id)
  SELECT project_id, id, plan_item_id FROM entries WHERE plan_item_id IS NOT NULL
  ON CONFLICT DO NOTHING;
`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS entry_issues, entry_plan_items`.execute(db);
}
