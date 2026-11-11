import type { Db } from '#src/server/db/client.ts';
import { addDays, isWorkingDay, isoDate, monthStart, weekStart, type IsoDate } from '#src/server/domain/calendar.ts';

/*
 * docs/04 §4.5: one project with 10,000 entries, 1,500 PRs, 500 issues and two years of
 * plans, inserted in batches. Deterministic: the same data every run.
 */

export const perfEnd = isoDate('2026-11-13');
const days = 730;

async function insertInBatches<T>(rows: readonly T[], insert: (batch: readonly T[]) => Promise<unknown>): Promise<void> {
  for (let index = 0; index < rows.length; index += 1000) {
    await insert(rows.slice(index, index + 1000));
  }
}

export async function seedPerformanceData(db: Db): Promise<{ readonly projectId: string }> {
  const project = await db.insertInto('projects').values({ name: 'Perf', slug: 'perf' }).returning('id').executeTakeFirstOrThrow();
  const projectId = project.id;
  const areas = await db
    .insertInto('areas')
    .values(['Frontend', 'Backend', 'Mobile', 'Infra'].map((name, position) => ({ projectId, name, position })))
    .returning('id')
    .execute();
  const people = await db
    .insertInto('people')
    .values(Array.from({ length: 8 }, (_, i) => ({ name: `Developer ${String(i + 1)}` })))
    .returning('id')
    .execute();
  const start = addDays(perfEnd, -days);
  const dateAt = (i: number, span: number): IsoDate => addDays(start, Math.floor((i * days) / span));

  const prRows = Array.from({ length: 1500 }, (_, i) => ({
    projectId,
    owner: 'acme',
    repo: ['app', 'api', 'mobile'][i % 3] ?? 'app',
    number: i + 1,
    title: `Pull request ${String(i + 1)}`,
    state: (['merged', 'open', 'merged', 'closed'] as const)[i % 4] ?? 'open',
    fetchedAt: new Date('2026-11-01T00:00:00Z'),
  }));
  const prIds: string[] = [];
  await insertInBatches(prRows, async (batch) => {
    prIds.push(...(await db.insertInto('pullRequests').values([...batch]).returning('id').execute()).map((row) => row.id));
  });

  const issueRows = Array.from({ length: 500 }, (_, i) => {
    const assignedOn = dateAt(i, 500);
    const deadline = addDays(assignedOn, 5);
    // Realistic: old issues are resolved; a few recent ones are still open.
    const resolved = !(addDays(assignedOn, 30) > perfEnd && i % 3 === 0);
    return {
      projectId,
      title: `Issue ${String(i + 1)}`,
      assignedOn,
      deadline,
      status: resolved ? ('resolved' as const) : ('open' as const),
      resolvedOn: resolved ? addDays(assignedOn, i % 9) : null,
      areaId: areas[i % areas.length]?.id ?? null,
    };
  });
  const issueIds: string[] = [];
  await insertInBatches(issueRows, async (batch) => {
    issueIds.push(...(await db.insertInto('issues').values([...batch]).returning('id').execute()).map((row) => row.id));
  });
  await insertInBatches(
    issueIds.map((issueId, i) => ({ issueId, personId: people[i % people.length]?.id ?? '' })),
    async (batch) => await db.insertInto('issueAssignees').values([...batch]).execute(),
  );

  // Two years of plans: a day plan per working day, a week plan per Monday, a month plan per month.
  const planRows: { projectId: string; horizon: 'day' | 'week' | 'month'; periodStart: IsoDate }[] = [];
  for (let i = 0; i <= days; i += 1) {
    const date = addDays(start, i);
    if (isWorkingDay(date)) {
      planRows.push({ projectId, horizon: 'day', periodStart: date });
    }
    if (date === weekStart(date)) {
      planRows.push({ projectId, horizon: 'week', periodStart: date });
    }
    if (date === monthStart(date)) {
      planRows.push({ projectId, horizon: 'month', periodStart: date });
    }
  }
  const plans: { id: string; periodStart: IsoDate }[] = [];
  await insertInBatches(planRows, async (batch) => {
    plans.push(...(await db.insertInto('plans').values([...batch]).returning(['id', 'periodStart']).execute()));
  });
  const itemRows = plans.flatMap((plan, p) =>
    [0, 1].map((n) => {
      // Realistic: work older than three weeks is done; recent plans are a mix.
      const done = addDays(plan.periodStart, 21) < perfEnd || (p + n) % 3 !== 0;
      return {
        projectId,
        planId: plan.id,
        title: `Plan item ${String(p)}-${String(n)}`,
        dueDate: plan.periodStart,
        status: done ? ('done' as const) : ('planned' as const),
        completedOn: done ? plan.periodStart : null,
      };
    }),
  );
  await insertInBatches(itemRows, async (batch) => await db.insertInto('planItems').values([...batch]).execute());

  const entryRows = Array.from({ length: 10_000 }, (_, i) => ({
    projectId,
    workDate: dateAt(i, 10_000),
    description: `Entry ${String(i + 1)}: worked on something worth reporting`,
    areaId: i % 7 === 0 ? null : (areas[i % areas.length]?.id ?? null),
    pullRequestId: i % 3 === 0 ? null : (prIds[Math.floor(i / 7) % prIds.length] ?? null),
  }));
  const entryIds: string[] = [];
  await insertInBatches(entryRows, async (batch) => {
    entryIds.push(...(await db.insertInto('entries').values([...batch]).returning('id').execute()).map((row) => row.id));
  });
  await insertInBatches(
    entryIds.map((entryId, i) => ({ entryId, personId: people[i % people.length]?.id ?? '' })),
    async (batch) => await db.insertInto('entryPeople').values([...batch]).execute(),
  );
  return { projectId };
}
