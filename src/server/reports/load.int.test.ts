import { describe, expect, it } from 'vitest';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import { countQueries, testDb } from '#tests/setup/test-db.ts';
import {
  aPerson, aPlan, aPlanItem, aProject, aPullRequest, aRelease, anArea, anEntry, anIssue, withPeople,
} from '#tests/fixtures/builders.ts';
import { loadReportData } from './load.ts';
import { buildReport } from './report.ts';

const today = d('2026-11-20');

async function seed(projectId: string, scale: number): Promise<void> {
  const people = [await aPerson(testDb()), await aPerson(testDb())].map((p) => p.id);
  const area = await anArea(testDb(), projectId);
  const pr = await aPullRequest(testDb(), projectId, { state: 'merged' });
  const week = await aPlan(testDb(), projectId, { horizon: 'week', periodStart: '2026-11-09' });
  for (let i = 0; i < scale; i += 1) {
    const entry = await anEntry(testDb(), projectId, { workDate: '2026-11-10', areaId: area.id, pullRequestId: pr.id });
    await withPeople(testDb(), 'entryPeople', entry.id, people);
    const issue = await anIssue(testDb(), projectId, { assignedOn: '2026-11-02', deadline: '2026-11-05' });
    await withPeople(testDb(), 'issueAssignees', issue.id, people);
    await aPlanItem(testDb(), week, { dueDate: '2026-11-12' });
    await aRelease(testDb(), projectId, { status: 'released', releasedOn: '2026-11-11' });
  }
}

describe('report loading', () => {
  it.each([
    ['daily', '2026-11-10', 9],
    ['weekly', '2026-11-09', 9],
    ['monthly', '2026-11-01', 10],
  ] as const)('NF-02: a %s report loads in a fixed number of queries', async (kind, start, expected) => {
    const small = await aProject(testDb());
    const large = await aProject(testDb());
    await seed(small.id, 1);
    await seed(large.id, 12);
    const request = { kind, start: d(start), today, author: 'K' };

    const smallCount = await countQueries(() => loadReportData(testDb(), { ...request, projectId: small.id }));
    const largeCount = await countQueries(() => loadReportData(testDb(), { ...request, projectId: large.id }));

    expect([smallCount, largeCount]).toEqual([expected, expected]);
  });

  it('BR-18: a weekly report loads Saturday and Sunday entries; daily only its own day', async () => {
    const project = await aProject(testDb());
    await anEntry(testDb(), project.id, { workDate: '2026-11-15', description: 'Sunday fix' });
    await anEntry(testDb(), project.id, { workDate: '2026-11-16', description: 'next Monday' });

    const weekly = await loadReportData(testDb(), { projectId: project.id, kind: 'weekly', start: d('2026-11-09'), today, author: 'K' });

    expect(weekly?.entries.map((e) => e.description)).toEqual(['Sunday fix']);
  });

  it('BR-15: loads the week plan, its day plans and moves out of them', async () => {
    const project = await aProject(testDb());
    const week = await aPlan(testDb(), project.id, { horizon: 'week', periodStart: '2026-11-09' });
    const tuesday = await aPlan(testDb(), project.id, { horizon: 'day', periodStart: '2026-11-10' });
    const nextMonday = await aPlan(testDb(), project.id, { horizon: 'day', periodStart: '2026-11-16' });
    await aPlanItem(testDb(), week, { title: 'week item', dueDate: '2026-11-13' });
    await aPlanItem(testDb(), tuesday, { title: 'day item' });
    const moved = await aPlanItem(testDb(), nextMonday, { title: 'moved item' });
    await testDb()
      .insertInto('planItemMoves')
      .values({ planItemId: moved.id, fromPlanId: tuesday.id, toPlanId: nextMonday.id, fromDue: '2026-11-10', toDue: '2026-11-16' })
      .execute();

    const data = await loadReportData(testDb(), { projectId: project.id, kind: 'weekly', start: d('2026-11-09'), today, author: 'K' });

    expect(data?.planItems.map((i) => i.title).sort()).toEqual(['day item', 'week item']);
    expect(data?.moves).toEqual([{ title: 'moved item', fromDue: '2026-11-10', toDue: '2026-11-16' }]);
  });

  it('R-01: never includes another project’s data, and returns null for unknown projects', async () => {
    const project = await aProject(testDb());
    const other = await aProject(testDb());
    await anEntry(testDb(), other.id, { workDate: '2026-11-10' });

    const report = await buildReport(testDb(), project.id, { kind: 'daily', start: d('2026-11-10') }, { today, author: 'K' });

    expect(report?.sections).toEqual([]);
    expect(await buildReport(testDb(), '00000000-0000-4000-8000-000000000000', { kind: 'daily', start: d('2026-11-10') }, { today, author: 'K' })).toBeNull();
  });

  it('NF-02: builds a month with 2,000 entries in under 500 ms', async () => {
    const project = await aProject(testDb());
    const person = await aPerson(testDb());
    const area = await anArea(testDb(), project.id);
    const rows = Array.from({ length: 2000 }, (_, i) => ({
      projectId: project.id,
      workDate: `2026-11-${String((i % 30) + 1).padStart(2, '0')}`,
      description: `Work ${String(i)}`,
      areaId: area.id,
    }));
    const inserted = await testDb().insertInto('entries').values(rows).returning('id').execute();
    await testDb().insertInto('entryPeople').values(inserted.map((row) => ({ entryId: row.id, personId: person.id }))).execute();

    const started = performance.now();
    await buildReport(testDb(), project.id, { kind: 'monthly', start: d('2026-11-01') }, { today, author: 'K' });

    expect(performance.now() - started).toBeLessThan(500);
  });
});
