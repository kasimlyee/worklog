import { describe, expect, it } from 'vitest';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import { testDb } from '#tests/setup/test-db.ts';
import { aPerson, aProject, anArea, anIssue, withPeople } from '#tests/fixtures/builders.ts';
import { getIssue } from './issues.ts';
import { planIssueForToday } from './plan-issue.ts';
import { getPlan } from './plans.ts';

const tuesday = d('2026-11-10');

describe('planning an issue for today', () => {
  it('BR-38: creates a plan item due today with the issue’s title, area and assignees, linked to the issue', async () => {
    const project = await aProject(testDb());
    const area = await anArea(testDb(), project.id, { name: 'Mobile' });
    const grace = await aPerson(testDb(), { name: 'Grace' });
    const issue = await anIssue(testDb(), project.id, { title: 'Crash on save', areaId: area.id });
    await withPeople(testDb(), 'issueAssignees', issue.id, [grace.id]);

    const result = await planIssueForToday(testDb(), project.id, issue.id, tuesday);

    expect(result).toMatchObject({ ok: true, value: { wasAlreadyPlanned: false } });
    const plan = await getPlan(testDb(), project.id, 'day', tuesday, tuesday);
    expect(plan?.items).toMatchObject([
      { title: 'Crash on save', dueDate: '2026-11-10', status: 'planned', area: { name: 'Mobile' }, issue: { id: issue.id }, assignees: [{ name: 'Grace' }] },
    ]);
  });

  it('BR-38: an open issue becomes in progress; one already in progress stays so', async () => {
    const project = await aProject(testDb());
    const open = await anIssue(testDb(), project.id);
    const started = await anIssue(testDb(), project.id, { status: 'in_progress' });

    await planIssueForToday(testDb(), project.id, open.id, tuesday);
    await planIssueForToday(testDb(), project.id, started.id, tuesday);

    expect((await getIssue(testDb(), project.id, open.id, tuesday))?.status).toBe('in_progress');
    expect((await getIssue(testDb(), project.id, started.id, tuesday))?.status).toBe('in_progress');
  });

  it('BR-38: planning the same issue twice does not add it twice', async () => {
    const project = await aProject(testDb());
    const issue = await anIssue(testDb(), project.id);

    const first = await planIssueForToday(testDb(), project.id, issue.id, tuesday);
    const second = await planIssueForToday(testDb(), project.id, issue.id, tuesday);

    expect(second).toEqual({ ok: true, value: { itemId: first.ok ? first.value.itemId : '', wasAlreadyPlanned: true } });
    expect((await getPlan(testDb(), project.id, 'day', tuesday, tuesday))?.items).toHaveLength(1);
  });

  it('BR-38: refuses a resolved issue, the weekend, and another project’s issue', async () => {
    const project = await aProject(testDb());
    const resolved = await anIssue(testDb(), project.id, { status: 'resolved', resolvedOn: '2026-11-09' });
    const open = await anIssue(testDb(), project.id);
    const foreign = await anIssue(testDb(), (await aProject(testDb())).id);

    expect(await planIssueForToday(testDb(), project.id, resolved.id, tuesday)).toEqual({
      ok: false,
      error: { code: 'invalid', fieldErrors: { issueId: 'This issue is already resolved.' } },
    });
    expect(await planIssueForToday(testDb(), project.id, open.id, d('2026-11-14'))).toEqual({
      ok: false,
      error: { code: 'invalid', fieldErrors: { issueId: 'There is no day plan at the weekend.' } },
    });
    expect(await planIssueForToday(testDb(), project.id, foreign.id, tuesday)).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await planIssueForToday(testDb(), project.id, 'bad', tuesday)).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await testDb().selectFrom('plans').selectAll().execute()).toEqual([]);
  });
});
