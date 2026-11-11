import { describe, expect, it } from 'vitest';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import { countQueries, testDb } from '#tests/setup/test-db.ts';
import { aPerson, aPlan, aPlanItem, aProject, anEntry, anIssue, withPeople } from '#tests/fixtures/builders.ts';
import { setProjectArchived } from './projects.ts';
import { getDashboard, listProjectSummaries } from './dashboard.ts';

const tuesday = d('2026-11-10');

describe('dashboard', () => {
  it('BR-13: urgent lists overdue plan items and issues, oldest first', async () => {
    const project = await aProject(testDb());
    const week = await aPlan(testDb(), project.id, { horizon: 'week', periodStart: '2026-11-02' });
    await aPlanItem(testDb(), week, { title: 'item due Thu', dueDate: '2026-11-05' });
    await anIssue(testDb(), project.id, { title: 'issue due Mon', assignedOn: '2026-11-01', deadline: '2026-11-02' });
    await aPlanItem(testDb(), week, { title: 'done', dueDate: '2026-11-03', status: 'done', completedOn: '2026-11-03' });
    await anIssue(testDb(), project.id, { title: 'resolved', assignedOn: '2026-11-01', deadline: '2026-11-02', status: 'resolved', resolvedOn: '2026-11-04' });

    const dashboard = await getDashboard(testDb(), project.id, tuesday);

    expect(dashboard.urgent.map((u) => (u.kind === 'issue' ? u.issue.title : u.item.title))).toEqual(['issue due Mon', 'item due Thu']);
  });

  it('BR-14: due soon covers today and the next working day, not overdue ones', async () => {
    const project = await aProject(testDb());
    const week = await aPlan(testDb(), project.id, { horizon: 'week', periodStart: '2026-11-09' });
    await aPlanItem(testDb(), week, { title: 'yesterday', dueDate: '2026-11-09' });
    await aPlanItem(testDb(), week, { title: 'today', dueDate: '2026-11-10' });
    await aPlanItem(testDb(), week, { title: 'tomorrow', dueDate: '2026-11-11' });
    await aPlanItem(testDb(), week, { title: 'later', dueDate: '2026-11-12' });
    await anIssue(testDb(), project.id, { title: 'issue tomorrow', deadline: '2026-11-11' });

    const dashboard = await getDashboard(testDb(), project.id, tuesday);

    expect(dashboard.dueSoon.map((u) => (u.kind === 'issue' ? u.issue.title : u.item.title))).toEqual(['today', 'tomorrow', 'issue tomorrow']);
    expect(dashboard.urgent).toHaveLength(1);
  });

  it('shows today’s day plan, and none on a weekend', async () => {
    const project = await aProject(testDb());
    await aPlanItem(testDb(), await aPlan(testDb(), project.id, { horizon: 'day', periodStart: '2026-11-10' }), { title: 'Standup notes' });

    expect((await getDashboard(testDb(), project.id, tuesday)).todaysPlan?.map((i) => i.title)).toEqual(['Standup notes']);
    expect((await getDashboard(testDb(), project.id, d('2026-11-14'))).todaysPlan).toBeNull();
  });

  it('lists open issues by deadline and the ten most recent entries', async () => {
    const project = await aProject(testDb());
    await anIssue(testDb(), project.id, { title: 'b', deadline: '2026-11-20' });
    await anIssue(testDb(), project.id, { title: 'a', deadline: '2026-11-12' });
    for (let day = 1; day <= 12; day += 1) {
      await anEntry(testDb(), project.id, { workDate: `2026-11-${String(day).padStart(2, '0')}` });
    }

    const dashboard = await getDashboard(testDb(), project.id, tuesday);

    expect(dashboard.openIssues.map((i) => i.title)).toEqual(['a', 'b']);
    expect(dashboard.recentEntries).toHaveLength(10);
    expect(dashboard.recentEntries[0]?.workDate).toBe('2026-11-12');
  });

  it('NF-01: uses four queries however much data there is', async () => {
    const project = await aProject(testDb());
    const person = await aPerson(testDb());
    const plan = await aPlan(testDb(), project.id, { horizon: 'day', periodStart: '2026-11-10' });
    for (let i = 0; i < 15; i += 1) {
      const item = await aPlanItem(testDb(), plan);
      await withPeople(testDb(), 'planItemAssignees', item.id, [person.id]);
      await anIssue(testDb(), project.id);
      await anEntry(testDb(), project.id);
    }

    expect(await countQueries(() => getDashboard(testDb(), project.id, tuesday))).toBe(4);
  });
});

describe('project switcher', () => {
  it('BR-13: counts overdue plan items and issues per active project', async () => {
    const atlas = await aProject(testDb(), { name: 'Atlas' });
    const borealis = await aProject(testDb(), { name: 'Borealis' });
    const archived = await aProject(testDb(), { name: 'Zed' });
    await setProjectArchived(testDb(), archived.id, true);
    await aPlanItem(testDb(), await aPlan(testDb(), atlas.id, { horizon: 'day', periodStart: '2026-11-06' }));
    await anIssue(testDb(), atlas.id, { assignedOn: '2026-11-01', deadline: '2026-11-06' });
    await anIssue(testDb(), atlas.id, { deadline: '2026-11-10' });

    const summaries = await listProjectSummaries(testDb(), tuesday);

    expect(summaries.map((p) => [p.name, p.overdueCount])).toEqual([['Atlas', 2], ['Borealis', 0]]);
    expect(borealis.id).toBe(summaries[1]?.id);
    expect(await countQueries(() => listProjectSummaries(testDb(), tuesday))).toBe(1);
  });
});
