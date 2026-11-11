import pg from 'pg';
import { createDb } from '#src/server/db/client.ts';
import { migrateToLatest } from '#src/server/db/migrator.ts';
import { adminDatabaseUrl, databaseUrl, templateDatabase } from './database-url.ts';

/** Once per run: drop old test databases, then build a freshly migrated template. */
export async function setup(): Promise<void> {
  const admin = new pg.Client({ connectionString: adminDatabaseUrl });
  await admin.connect();
  try {
    const { rows } = await admin.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname LIKE 'worklog\\_test\\_%'",
    );
    for (const { datname } of rows) {
      await admin.query(`DROP DATABASE "${datname}" WITH (FORCE)`);
    }
    await admin.query(`CREATE DATABASE "${templateDatabase}"`);
  } finally {
    await admin.end();
  }

  const template = createDb({ connectionString: databaseUrl(templateDatabase), maxConnections: 1 });
  try {
    const { error } = await migrateToLatest(template);
    if (error !== undefined) {
      throw error instanceof Error ? error : new Error('Migration of the test template failed');
    }
  } finally {
    await template.destroy();
  }
}
