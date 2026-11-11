import { afterAll, beforeAll } from 'vitest';
import { openWorkerDb, truncateAll } from './test-db.ts';

// The performance suite seeds once per file and keeps the data across its tests.
const db = await openWorkerDb(`perf_${process.env['VITEST_POOL_ID'] ?? '1'}`);

beforeAll(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await db.destroy();
});
