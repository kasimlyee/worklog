import { sql, type Kysely } from 'kysely';

/*
 * BR-50: a plan item working on an issue is finished when a log fixes the issue. Items
 * whose issue was fixed before this rule are finished now, on the day the issue was
 * resolved. Data only; an older build reads the rows as they are.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
UPDATE plan_items pi
   SET status = 'done', completed_on = i.resolved_on, updated_at = now()
  FROM issues i
 WHERE i.id = pi.issue_id
   AND i.status = 'resolved'
   AND i.resolved_on IS NOT NULL
   AND pi.status <> 'done';
`.execute(db);
}

/** Nothing to undo safely: which items were finished here is not recorded. */
export async function down(): Promise<void> {
  // Intentionally empty.
}
