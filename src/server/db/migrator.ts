import 'server-only';
import { Migrator, type Migration, type MigrationResultSet } from 'kysely/migration';
import type { Db } from './client.ts';
import * as initial from './migrations/0001_initial.ts';
import * as planItemsCompletedIndex from './migrations/0002_plan_items_completed_index.ts';

// Listed explicitly (not read from disk) so the bundle and plain Node agree on the set.
const migrations: Readonly<Record<string, Migration>> = {
  '0001_initial': initial,
  '0002_plan_items_completed_index': planItemsCompletedIndex,
};

export async function migrateToLatest(db: Db): Promise<MigrationResultSet> {
  const migrator = new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve(migrations) },
  });
  return await migrator.migrateToLatest();
}
