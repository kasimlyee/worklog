import pg from 'pg';
import { createDb, type Db } from '#src/server/db/client.ts';
import { migrateToLatest } from '#src/server/db/migrator.ts';
import { hashToken } from '#src/server/auth/tokens.ts';
import { truncateAll } from '#tests/setup/test-db.ts';

/* The E2E database: created and migrated once, emptied before each journey. */

export const e2eDatabaseUrl = process.env['E2E_DATABASE_URL'] ?? 'postgres://worklog:worklog@127.0.0.1:5433/worklog_e2e';
export const allowedUserId = 4242;

export async function prepareDatabase(): Promise<void> {
  const url = new URL(e2eDatabaseUrl);
  const name = url.pathname.slice(1);
  url.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (rowCount === 0) {
      await admin.query(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await admin.end();
  }
  const db = createDb({ connectionString: e2eDatabaseUrl, maxConnections: 1 });
  try {
    const { error } = await migrateToLatest(db);
    if (error !== undefined) {
      throw error instanceof Error ? error : new Error('E2E migration failed');
    }
  } finally {
    await db.destroy();
  }
}

let shared: Db | undefined;

export function e2eDb(): Db {
  shared ??= createDb({ connectionString: e2eDatabaseUrl, maxConnections: 2 });
  return shared;
}

export async function resetDatabase(): Promise<void> {
  await truncateAll(e2eDb());
}

/** docs/04 §3.2: sign in by inserting a session row; OAuth itself is covered by handler tests. */
export async function createSessionToken(options: { readonly expired?: boolean; readonly userId?: number } = {}): Promise<string> {
  const token = `e2e-${crypto.randomUUID()}`;
  const now = Date.now();
  const createdAt = new Date(now - 2 * 24 * 60 * 60 * 1000);
  const expiresAt = new Date(options.expired === true ? now - 1000 : now + 24 * 60 * 60 * 1000);
  await e2eDb()
    .insertInto('sessions')
    .values({ tokenHash: hashToken(token), githubUserId: options.userId ?? allowedUserId, createdAt, expiresAt })
    .execute();
  return token;
}
