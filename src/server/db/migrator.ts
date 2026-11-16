import 'server-only';
import { Migrator, type Migration, type MigrationResultSet } from 'kysely/migration';
import type { Db } from './client.ts';
import * as initial from './migrations/0001_initial.ts';
import * as planItemsCompletedIndex from './migrations/0002_plan_items_completed_index.ts';
import * as issuePriority from './migrations/0003_issue_priority.ts';
import * as issueDescription from './migrations/0004_issue_description.ts';
import * as entryLinks from './migrations/0005_entry_links.ts';
import * as logClosesWork from './migrations/0006_log_closes_work.ts';
import * as planItemDescription from './migrations/0007_plan_item_description.ts';

// Listed explicitly (not read from disk) so the bundle and plain Node agree on the set.
const migrations: Readonly<Record<string, Migration>> = {
  '0001_initial': initial,
  '0002_plan_items_completed_index': planItemsCompletedIndex,
  '0003_issue_priority': issuePriority,
  '0004_issue_description': issueDescription,
  '0005_entry_links': entryLinks,
  '0006_log_closes_work': logClosesWork,
  '0007_plan_item_description': planItemDescription,
};

export async function migrateToLatest(db: Db): Promise<MigrationResultSet> {
  const migrator = new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve(migrations) },
  });
  return await migrator.migrateToLatest();
}
