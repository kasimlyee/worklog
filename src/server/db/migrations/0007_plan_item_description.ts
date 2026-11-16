import { sql, type Kysely } from 'kysely';

/*
 * BR-48: plan items get an optional description (≤ 2,000 characters). Items written as
 * "Name — what it means" (the W7 import) are split: the name stays the title, the rest
 * becomes the description. Additive: an older build ignores the column.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
ALTER TABLE plan_items ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
DO $$ BEGIN
  ALTER TABLE plan_items ADD CONSTRAINT plan_items_description_check CHECK (length(description) <= 2000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
UPDATE plan_items
   SET description = btrim(substr(title, position(' — ' in title) + 3)),
       title = btrim(left(title, position(' — ' in title) - 1))
 WHERE description = ''
   AND position(' — ' in title) > 1
   AND btrim(substr(title, position(' — ' in title) + 3)) <> '';
`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
UPDATE plan_items SET title = left(title || ' — ' || description, 300) WHERE description <> '';
ALTER TABLE plan_items DROP COLUMN IF EXISTS description;
`.execute(db);
}
