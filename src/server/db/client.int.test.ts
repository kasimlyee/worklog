import { sql } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import { testDb } from '#tests/setup/test-db.ts';
import { aProject, anEntry } from '#tests/fixtures/builders.ts';

describe('database client', () => {
  it('BR-01: a date column round-trips as the same YYYY-MM-DD string in a negative-offset zone', async () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    const project = await aProject(testDb());
    await anEntry(testDb(), project.id, { workDate: '2026-11-09' });

    const row = await testDb().selectFrom('entries').select('workDate').executeTakeFirstOrThrow();

    expect(row.workDate).toBe('2026-11-09');
  });

  it('BR-01: a date computed in SQL also stays a plain string', async () => {
    const { rows } = await sql<{ d: string }>`SELECT DATE '2026-12-31' AS d`.execute(testDb());

    expect(rows[0]?.d).toBe('2026-12-31');
  });
});
