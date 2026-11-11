import { sql, type Kysely } from 'kysely';

// BR-27: an optional short description. Additive: existing issues get '' and an older build ignores it.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
ALTER TABLE issues ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
DO $$ BEGIN
  ALTER TABLE issues ADD CONSTRAINT issues_description_check CHECK (length(description) <= 2000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE issues DROP COLUMN IF EXISTS description`.execute(db);
}
