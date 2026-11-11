import { sql, type Kysely } from 'kysely';

// BR-37. Additive: existing issues become `medium`, and an older build ignores the column.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
DO $$ BEGIN
  CREATE TYPE issue_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS priority issue_priority NOT NULL DEFAULT 'medium';
`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE issues DROP COLUMN IF EXISTS priority; DROP TYPE IF EXISTS issue_priority;`.execute(db);
}
