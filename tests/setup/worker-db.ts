import { afterAll, beforeEach } from 'vitest';
import { openWorkerDb, truncateAll } from './test-db.ts';

// docs/03 §3.1: each worker has its own database; every test starts from empty tables.
const db = await openWorkerDb(process.env['VITEST_POOL_ID'] ?? '1');

beforeEach(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await db.destroy();
});
