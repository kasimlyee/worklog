import { sql } from 'kysely';
import pg from 'pg';
import { createDb, type Db } from '#src/server/db/client.ts';
import { adminDatabaseUrl, databaseUrl, templateDatabase } from './database-url.ts';

let current: Db | undefined;
let queryCount = 0;

/** The database of the current Vitest worker. */
export function testDb(): Db {
  if (current === undefined) {
    throw new Error('testDb() is only available in integration tests (*.int.test.ts).');
  }
  return current;
}

/** Runs `action` and returns how many SQL statements it executed (docs/02 §13). */
export async function countQueries(action: () => Promise<unknown>): Promise<number> {
  const before = queryCount;
  await action();
  return queryCount - before;
}

export async function openWorkerDb(workerId: string): Promise<Db> {
  const name = `worklog_test_${workerId}`;
  const admin = new pg.Client({ connectionString: adminDatabaseUrl });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (rowCount === 0) {
      await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${templateDatabase}"`);
    }
  } finally {
    await admin.end();
  }
  current = createDb({
    connectionString: databaseUrl(name),
    maxConnections: 2,
    log: (event) => {
      if (event.level === 'query') {
        queryCount += 1;
      }
    },
  });
  return current;
}

const tables = [
  'sessions', 'projects', 'areas', 'people', 'pull_requests', 'issues', 'issue_assignees', 'plans',
  'plan_items', 'plan_item_assignees', 'plan_item_moves', 'entries', 'entry_people', 'releases',
  'release_pull_requests', 'notes', 'note_links', 'report_notes',
] as const;

export async function truncateAll(db: Db): Promise<void> {
  // eslint-disable-next-line no-restricted-syntax -- constant table names only
  await sql`TRUNCATE ${sql.raw(tables.join(', '))} CASCADE`.execute(db);
}
