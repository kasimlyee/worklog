import { sql } from 'kysely';
import pg from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '#src/server/db/client.ts';
import { addDays } from '#src/server/domain/calendar.ts';
import { databaseUrl } from '#tests/setup/database-url.ts';
import { countQueries, testDb } from '#tests/setup/test-db.ts';
import { perfEnd, seedPerformanceData } from '#tests/fixtures/perf-seed.ts';
import { buildReport } from './reports/report.ts';
import { loadReportData } from './reports/load.ts';
import { renderPdf } from './reports/render-pdf.ts';
import { getDashboard, listProjectSummaries } from './services/dashboard.ts';
import { listEntries } from './services/entries.ts';

/* docs/04 §4.5 (nightly): NF-01…NF-03 against a realistic data volume, and index use. */

let projectId = '';
const today = perfEnd;

beforeAll(async () => {
  ({ projectId } = await seedPerformanceData(testDb()));
  await sql`ANALYZE`.execute(testDb());
}, 120_000);

async function p95(runs: number, action: () => Promise<unknown>): Promise<number> {
  await action(); // warm-up
  const timings: number[] = [];
  for (let run = 0; run < runs; run += 1) {
    const started = performance.now();
    await action();
    timings.push(performance.now() - started);
  }
  timings.sort((a, b) => a - b);
  return timings[Math.ceil(runs * 0.95) - 1] ?? Infinity;
}

describe('performance with 10,000 entries', () => {
  it('NF-01: the dashboard data loads in under 300 ms at p95', async () => {
    expect(await p95(30, () => getDashboard(testDb(), projectId, today))).toBeLessThan(300);
  });

  it('NF-01: the project switcher and the log page are fast too', async () => {
    expect(await p95(30, () => listProjectSummaries(testDb(), today))).toBeLessThan(300);
    expect(await p95(30, () => listEntries(testDb(), projectId, {}))).toBeLessThan(300);
  });

  it('NF-02: a monthly report model builds in under 500 ms, in a fixed number of queries', async () => {
    const request = { kind: 'monthly' as const, start: addDays(perfEnd, -12) };
    expect(request.start).toBe('2026-11-01');

    expect(await p95(10, () => buildReport(testDb(), projectId, request, { today, author: 'K' }))).toBeLessThan(500);
    expect(await countQueries(() => loadReportData(testDb(), { projectId, ...request, today, author: 'K' }))).toBe(10);
  });

  it('NF-03: a monthly PDF export renders in under 2 s', async () => {
    const model = await buildReport(testDb(), projectId, { kind: 'monthly', start: addDays(perfEnd, -12) }, { today, author: 'K' });
    if (model === null) {
      throw new Error('no model');
    }

    expect(await p95(5, () => renderPdf(model))).toBeLessThan(2000);
  });
});

/** Runs `action` with a database that records every statement, then EXPLAINs each one. */
async function plansOf(action: (db: Db) => Promise<unknown>): Promise<readonly string[]> {
  const url = databaseUrl(`worklog_test_perf_${process.env['VITEST_POOL_ID'] ?? '1'}`);
  const statements: { sql: string; parameters: readonly unknown[] }[] = [];
  const recorder = createDb({
    connectionString: url,
    maxConnections: 1,
    log: (event) => {
      statements.push({ sql: event.query.sql, parameters: event.query.parameters });
    },
  });
  try {
    await action(recorder);
  } finally {
    await recorder.destroy();
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    // On tables this size Postgres may rightly prefer a scan. With scans priced out, any
    // Seq Scan left in a plan means no index can serve that query — which is what we check.
    await client.query('SET enable_seqscan = off');
    const plans: string[] = [];
    for (const statement of statements) {
      const { rows } = await client.query<{ 'QUERY PLAN': unknown }>(`EXPLAIN (FORMAT JSON) ${statement.sql}`, [...statement.parameters]);
      plans.push(JSON.stringify(rows[0]?.['QUERY PLAN']));
    }
    return plans;
  } finally {
    await client.end();
  }
}

const hotTables = ['entries', 'plan_items', 'issues'];

/** Tables in `hotTables` that some plan can only read with a sequential scan. */
function sequentialScans(plans: readonly string[]): readonly string[] {
  return plans.flatMap((plan) =>
    [...plan.matchAll(/"Node Type":"Seq Scan"[^}]*?"Relation Name":"(\w+)"/g)].map((match) => match[1] ?? '').filter((table) => hotTables.includes(table)),
  );
}

describe('index use', () => {
  it('NF-01: the dashboard queries never scan entries, plan_items or issues sequentially', async () => {
    expect(sequentialScans(await plansOf((db) => getDashboard(db, projectId, today)))).toEqual([]);
  });

  it('NF-02: the monthly and weekly report queries never scan those tables sequentially', async () => {
    const monthly = await plansOf((db) => loadReportData(db, { projectId, kind: 'monthly', start: addDays(perfEnd, -12), today, author: 'K' }));
    const weekly = await plansOf((db) => loadReportData(db, { projectId, kind: 'weekly', start: addDays(perfEnd, -4), today, author: 'K' }));

    expect(sequentialScans([...monthly, ...weekly])).toEqual([]);
  });
});
