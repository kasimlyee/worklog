/**
 * Applies pending migrations. Uses DATABASE_URL_DIRECT (Neon non-pooled), falling back
 * to DATABASE_URL for local development.
 *
 *   npm run db:migrate
 */
import { createDb } from '#src/server/db/client.ts';
import { migrateToLatest } from '#src/server/db/migrator.ts';

const connectionString = process.env['DATABASE_URL_DIRECT'] ?? process.env['DATABASE_URL'];
if (connectionString === undefined || connectionString === '') {
  console.error('Set DATABASE_URL_DIRECT (or DATABASE_URL) to run migrations.');
  process.exit(1);
}

const db = createDb({ connectionString, maxConnections: 1 });
try {
  const { error, results = [] } = await migrateToLatest(db);
  for (const result of results) {
    console.log(`${result.status}: ${result.migrationName}`);
  }
  if (results.length === 0) {
    console.log('No pending migrations.');
  }
  if (error !== undefined) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  }
} finally {
  await db.destroy();
}
