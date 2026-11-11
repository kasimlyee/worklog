import { sql, type Kysely } from 'kysely';

// Reports find items completed in, or after, a period (docs/04 §4.5: no sequential scans).
// Additive only, so a running older version is unaffected.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE INDEX IF NOT EXISTS plan_items_completed_idx ON plan_items (project_id, completed_on) WHERE completed_on IS NOT NULL`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS plan_items_completed_idx`.execute(db);
}
