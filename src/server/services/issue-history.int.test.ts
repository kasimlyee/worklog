import { describe, expect, it } from 'vitest';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import { countQueries, testDb } from '#tests/setup/test-db.ts';
import { aPerson, aPlan, aPlanItem, aProject, aPullRequest, anEntry, anIssue, withPeople } from '#tests/fixtures/builders.ts';
import { getIssueHistory } from './issue-history.ts';

const today = d('2026-11-10');

describe('issue history', () => {
  it('BR-40: lists the plan items and log entries linked to the issue, oldest first, in two queries', async () => {
    const project = await aProject(testDb());
    const issue = await anIssue(testDb(), project.id);
    const other = await anIssue(testDb(), project.id);
    const grace = await aPerson(testDb(), { name: 'Grace' });
    const pr = await aPullRequest(testDb(), project.id, { number: 12 });
    const plan = await aPlan(testDb(), project.id, { horizon: 'week', periodStart: '2026-11-09' });
    await aPlanItem(testDb(), plan, { title: 'Fix share links', issueId: issue.id, dueDate: '2026-11-11' });
    await aPlanItem(testDb(), plan, { title: 'unrelated', issueId: other.id });
    const later = await anEntry(testDb(), project.id, { workDate: '2026-11-10', description: 'Moved the domain', issueId: issue.id, pullRequestId: pr.id });
    await withPeople(testDb(), 'entryPeople', later.id, [grace.id]);
    await anEntry(testDb(), project.id, { workDate: '2026-11-09', description: 'Found the cause', issueId: issue.id });
    await anEntry(testDb(), project.id, { workDate: '2026-11-09', description: 'not this issue' });

    let history = await getIssueHistory(testDb(), project.id, issue.id, today);
    const queries = await countQueries(async () => {
      history = await getIssueHistory(testDb(), project.id, issue.id, today);
    });

    expect(history.planItems.map((i) => i.title)).toEqual(['Fix share links']);
    expect(history.entries.map((e) => [e.workDate, e.description, e.pullRequest?.number ?? null, e.people.map((p) => p.name)])).toEqual([
      ['2026-11-09', 'Found the cause', null, []],
      ['2026-11-10', 'Moved the domain', 12, ['Grace']],
    ]);
    expect(queries).toBe(2);
  });

  it('BR-40: an unknown or foreign issue has no history', async () => {
    const project = await aProject(testDb());
    const foreign = await anIssue(testDb(), (await aProject(testDb())).id);
    await anEntry(testDb(), (await aProject(testDb())).id, { issueId: null });

    expect(await getIssueHistory(testDb(), project.id, foreign.id, today)).toEqual({ planItems: [], entries: [] });
    expect(await getIssueHistory(testDb(), project.id, 'bad', today)).toEqual({ planItems: [], entries: [] });
  });
});
