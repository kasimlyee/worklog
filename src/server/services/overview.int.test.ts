import { describe, expect, it } from 'vitest';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import { countQueries, testDb } from '#tests/setup/test-db.ts';
import { aPerson, aPlan, aPlanItem, aProject, anIssue, withPeople } from '#tests/fixtures/builders.ts';
import { setProjectArchived } from './projects.ts';
import { getOverview, getWorkload } from './overview.ts';

const tuesday = d('2026-11-10');

describe('cross-project overview', () => {
  it('BR-42: lists overdue work and urgent issues from every project, oldest first, labelled with the project', async () => {
    const atlas = await aProject(testDb(), { name: 'Atlas' });
    const borealis = await aProject(testDb(), { name: 'Borealis' });
    const old = await aProject(testDb(), { name: 'Old' });
    await setProjectArchived(testDb(), old.id, true);
    await aPlanItem(testDb(), await aPlan(testDb(), atlas.id, { horizon: 'day', periodStart: '2026-11-06' }), { title: 'atlas overdue' });
    await anIssue(testDb(), borealis.id, { title: 'borealis overdue', assignedOn: '2026-11-01', deadline: '2026-11-04' });
    await anIssue(testDb(), borealis.id, { title: 'urgent, not yet due', deadline: '2026-12-01', priority: 'urgent' });
    await anIssue(testDb(), old.id, { title: 'archived project', assignedOn: '2026-11-01', deadline: '2026-11-02' });

    const overview = await getOverview(testDb(), tuesday);

    expect(overview.attention.map((item) => [item.project.name, item.title, item.deadline.state])).toEqual([
      ['Borealis', 'borealis overdue', 'overdue'],
      ['Atlas', 'atlas overdue', 'overdue'],
      ['Borealis', 'urgent, not yet due', 'on_track'],
    ]);
  });

  it('BR-42: due soon across projects, today’s progress per project, and what was done this week', async () => {
    const atlas = await aProject(testDb(), { name: 'Atlas' });
    const borealis = await aProject(testDb(), { name: 'Borealis' });
    const today = await aPlan(testDb(), atlas.id, { horizon: 'day', periodStart: '2026-11-10' });
    await aPlanItem(testDb(), today, { title: 'due today' });
    await aPlanItem(testDb(), today, { title: 'finished today', status: 'done', completedOn: '2026-11-10' });
    await anIssue(testDb(), borealis.id, { title: 'due tomorrow', deadline: '2026-11-11' });
    await anIssue(testDb(), borealis.id, { title: 'fixed last week', status: 'resolved', resolvedOn: '2026-11-05', deadline: '2026-11-06' });
    await anIssue(testDb(), borealis.id, { title: 'fixed long ago', status: 'resolved', resolvedOn: '2026-10-01', assignedOn: '2026-09-01', deadline: '2026-10-02' });

    const overview = await getOverview(testDb(), tuesday);

    expect(overview.dueSoon.map((item) => item.title)).toEqual(['due today', 'due tomorrow']);
    expect(overview.projects.map((p) => [p.name, p.today])).toEqual([
      ['Atlas', { done: 1, total: 2 }],
      ['Borealis', { done: 0, total: 0 }],
    ]);
    expect(overview.recentlyDone.map((done) => [done.projectName, done.kind, done.title, done.doneOn])).toEqual([
      ['Atlas', 'plan_item', 'finished today', '2026-11-10'],
      ['Borealis', 'issue', 'fixed last week', '2026-11-05'],
    ]);
  });

  it('NF-01: the overview takes five queries however many projects there are', async () => {
    for (let n = 0; n < 6; n += 1) {
      const project = await aProject(testDb());
      await anIssue(testDb(), project.id);
    }

    expect(await countQueries(() => getOverview(testDb(), tuesday))).toBe(5);
  });

  it('BR-42: at the weekend there is no today progress', async () => {
    await aProject(testDb());

    expect((await getOverview(testDb(), d('2026-11-14'))).projects[0]?.today).toBeNull();
  });
});

describe('developer workload', () => {
  it('BR-43: counts each person’s open, overdue, blocked and recently finished assignments across projects', async () => {
    const atlas = await aProject(testDb(), { name: 'Atlas' });
    const borealis = await aProject(testDb(), { name: 'Borealis' });
    const grace = await aPerson(testDb(), { name: 'Grace' });
    const ali = await aPerson(testDb(), { name: 'Ali' });
    const gone = await aPerson(testDb(), { name: 'Gone', archivedAt: new Date() });
    const plan = await aPlan(testDb(), atlas.id, { horizon: 'month', periodStart: '2026-11-01' });
    const late = await aPlanItem(testDb(), plan, { dueDate: '2026-11-03' });
    const blocked = await aPlanItem(testDb(), plan, { dueDate: '2026-11-20', status: 'blocked' });
    const done = await aPlanItem(testDb(), plan, { dueDate: '2026-11-04', status: 'done', completedOn: '2026-11-04' });
    for (const item of [late, blocked, done]) {
      await withPeople(testDb(), 'planItemAssignees', item.id, [grace.id]);
    }
    const issue = await anIssue(testDb(), borealis.id, { assignedOn: '2026-11-01', deadline: '2026-11-05' });
    await withPeople(testDb(), 'issueAssignees', issue.id, [grace.id, gone.id]);

    const workload = await getWorkload(testDb(), tuesday);

    expect(workload).toEqual([
      { id: ali.id, name: 'Ali', openItems: 0, overdueItems: 0, blockedItems: 0, openIssues: 0, overdueIssues: 0, doneRecently: 0, projects: [] },
      {
        id: grace.id,
        name: 'Grace',
        openItems: 2,
        overdueItems: 1,
        blockedItems: 1,
        openIssues: 1,
        overdueIssues: 1,
        doneRecently: 1,
        projects: ['Atlas', 'Borealis'],
      },
    ]);
    expect(await countQueries(() => getWorkload(testDb(), tuesday))).toBe(1);
  });
});
