import { describe, expect, it } from 'vitest';
import { anyString } from '#tests/fixtures/matchers.ts';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import { testDb } from '#tests/setup/test-db.ts';
import { aPerson, aPlan, aPlanItem, aProject, anArea, anIssue } from '#tests/fixtures/builders.ts';
import {
  createPlanItem, deletePlanItem, getPlan, getPlanItem, listOpenPlanItems, movePlanItem, setPlanItemStatus, updatePlanItem,
} from './plans.ts';

const today = d('2026-11-10');

async function itemIdOf(result: Awaited<ReturnType<typeof createPlanItem>>): Promise<string> {
  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }
  return await Promise.resolve(result.value.id);
}

describe('plan items', () => {
  it('BR-10: creates an item with area, assignees, issue and status planned', async () => {
    const project = await aProject(testDb());
    const area = await anArea(testDb(), project.id, { name: 'Web' });
    const issue = await anIssue(testDb(), project.id, { title: 'Login bug' });
    const grace = await aPerson(testDb(), { name: 'Grace' });

    const id = await itemIdOf(
      await createPlanItem(testDb(), project.id, {
        horizon: 'week',
        periodStart: '2026-11-09',
        title: 'Ship login',
        dueDate: '2026-11-12',
        areaId: area.id,
        issueId: issue.id,
        personIds: [grace.id],
      }),
    );

    expect(await getPlanItem(testDb(), project.id, id, today)).toEqual({
      id,
      horizon: 'week',
      title: 'Ship login',
      status: 'planned',
      dueDate: '2026-11-12',
      completedOn: null,
      area: { id: area.id, name: 'Web' },
      issue: { id: issue.id, title: 'Login bug' },
      assignees: [{ id: grace.id, name: 'Grace' }],
      moves: [],
      deadline: { state: 'on_track', label: 'Due in 2 days' },
    });
  });

  it('BR-10: an item may have zero assignees and no area', async () => {
    const project = await aProject(testDb());

    const result = await createPlanItem(testDb(), project.id, { horizon: 'day', periodStart: '2026-11-10', title: 'Review', dueDate: '2026-11-10' });

    expect(result.ok).toBe(true);
  });

  it('BR-09: creates the plan on first item and reuses it after', async () => {
    const project = await aProject(testDb());
    const input = { horizon: 'month', periodStart: '2026-11-01', title: 'x', dueDate: '2026-11-20' };

    await createPlanItem(testDb(), project.id, input);
    await createPlanItem(testDb(), project.id, input);

    expect(await testDb().selectFrom('plans').selectAll().execute()).toHaveLength(1);
    expect((await getPlan(testDb(), project.id, 'month', d('2026-11-15'), today))?.items).toHaveLength(2);
  });

  it('BR-11: refuses a due date outside the plan period', async () => {
    const project = await aProject(testDb());

    const result = await createPlanItem(testDb(), project.id, { horizon: 'week', periodStart: '2026-11-09', title: 'x', dueDate: '2026-11-14' });

    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid', fieldErrors: { dueDate: 'The due date must be within Week of 9–13 Nov 2026.' } },
    });
  });

  it('BR-08: refuses a period start that does not begin a plan', async () => {
    const project = await aProject(testDb());

    const result = await createPlanItem(testDb(), project.id, { horizon: 'week', periodStart: '2026-11-10', title: 'x', dueDate: '2026-11-10' });

    expect(result.ok || result.error).toEqual({ code: 'invalid', fieldErrors: { periodStart: 'That is not the start of a plan period.' } });
  });

  it('BR-12: refuses an issue or area of another project', async () => {
    const project = await aProject(testDb());
    const other = await aProject(testDb());
    const issue = await anIssue(testDb(), other.id);

    const result = await createPlanItem(testDb(), project.id, {
      horizon: 'day', periodStart: '2026-11-10', title: 'x', dueDate: '2026-11-10', issueId: issue.id,
    });

    expect(result.ok || result.error).toEqual({ code: 'invalid', fieldErrors: { issueId: 'Choose an issue of this project.' } });
  });

  it('updates title, area, issue and assignees', async () => {
    const project = await aProject(testDb());
    const ali = await aPerson(testDb(), { name: 'Ali' });
    const item = await aPlanItem(testDb(), await aPlan(testDb(), project.id));

    const result = await updatePlanItem(testDb(), project.id, item.id, { title: 'Renamed', personIds: [ali.id] });

    expect(result.ok).toBe(true);
    expect(await getPlanItem(testDb(), project.id, item.id, today)).toMatchObject({ title: 'Renamed', assignees: [{ name: 'Ali' }] });
    expect(await updatePlanItem(testDb(), project.id, 'bad', { title: 'x' })).toEqual({ ok: false, error: { code: 'not_found' } });
    expect((await updatePlanItem(testDb(), project.id, item.id, { title: '' })).ok).toBe(false);
    expect((await updatePlanItem(testDb(), project.id, item.id, { title: 'x', areaId: project.id })).ok).toBe(false);
    const other = await aProject(testDb());
    expect(await updatePlanItem(testDb(), other.id, item.id, { title: 'x' })).toEqual({ ok: false, error: { code: 'not_found' } });
  });
});

describe('status', () => {
  it('BR-16: records completed_on when done and clears it when reopened', async () => {
    const project = await aProject(testDb());
    const item = await aPlanItem(testDb(), await aPlan(testDb(), project.id));

    await setPlanItemStatus(testDb(), project.id, item.id, { status: 'done' }, today);
    expect(await getPlanItem(testDb(), project.id, item.id, today)).toMatchObject({ status: 'done', completedOn: '2026-11-10', deadline: null });

    await setPlanItemStatus(testDb(), project.id, item.id, { status: 'in_progress' }, today);
    expect(await getPlanItem(testDb(), project.id, item.id, today)).toMatchObject({ status: 'in_progress', completedOn: null });
  });

  it('BR-10: rejects an unknown status and unknown items', async () => {
    const project = await aProject(testDb());
    const item = await aPlanItem(testDb(), await aPlan(testDb(), project.id));

    expect((await setPlanItemStatus(testDb(), project.id, item.id, { status: 'finished' }, today)).ok).toBe(false);
    expect(await setPlanItemStatus(testDb(), project.id, 'bad', { status: 'done' }, today)).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await setPlanItemStatus(testDb(), project.id, project.id, { status: 'done' }, today)).toEqual({ ok: false, error: { code: 'not_found' } });
  });
});

describe('carry-over', () => {
  it('BR-15: moves into the plan covering the new date, creating it, and records history', async () => {
    const project = await aProject(testDb());
    const plan = await aPlan(testDb(), project.id, { horizon: 'day', periodStart: '2026-11-09' });
    const item = await aPlanItem(testDb(), plan, { dueDate: '2026-11-09' });

    const result = await movePlanItem(testDb(), project.id, item.id, { dueDate: '2026-11-11' });

    expect(result).toEqual({ ok: true, value: { id: item.id } });
    const moved = await getPlanItem(testDb(), project.id, item.id, today);
    expect(moved).toMatchObject({ dueDate: '2026-11-11', moves: [{ fromDue: '2026-11-09', toDue: '2026-11-11', movedAt: anyString }] });
    expect((await getPlan(testDb(), project.id, 'day', d('2026-11-09'), today))?.items).toEqual([]);
    expect((await getPlan(testDb(), project.id, 'day', d('2026-11-11'), today))?.items.map((i) => i.id)).toEqual([item.id]);
  });

  it('BR-15: a week item moved into next week lands in next week’s plan', async () => {
    const project = await aProject(testDb());
    const item = await aPlanItem(testDb(), await aPlan(testDb(), project.id, { horizon: 'week', periodStart: '2026-11-09' }), {
      dueDate: '2026-11-13',
    });

    await movePlanItem(testDb(), project.id, item.id, { dueDate: '2026-11-17' });

    const plans = await testDb().selectFrom('plans').select(['horizon', 'periodStart']).orderBy('periodStart').execute();
    expect(plans).toEqual([{ horizon: 'week', periodStart: '2026-11-09' }, { horizon: 'week', periodStart: '2026-11-16' }]);
  });

  it('BR-15: clears the overdue state once moved to a future date', async () => {
    const project = await aProject(testDb());
    const item = await aPlanItem(testDb(), await aPlan(testDb(), project.id, { horizon: 'day', periodStart: '2026-11-09' }));
    expect((await getPlanItem(testDb(), project.id, item.id, today))?.deadline?.state).toBe('overdue');

    await movePlanItem(testDb(), project.id, item.id, { dueDate: '2026-11-12' });

    expect((await getPlanItem(testDb(), project.id, item.id, today))?.deadline?.state).toBe('on_track');
  });

  it('BR-15: nothing moves automatically — an overdue item stays in its plan', async () => {
    const project = await aProject(testDb());
    const item = await aPlanItem(testDb(), await aPlan(testDb(), project.id, { horizon: 'day', periodStart: '2026-11-02' }));

    const plan = await getPlan(testDb(), project.id, 'day', d('2026-11-02'), today);

    expect(plan?.items.map((i) => [i.id, i.deadline?.label])).toEqual([[item.id, '8 days overdue']]);
  });

  it.each([
    ['a weekend date for a day plan', { dueDate: '2026-11-14' }, 'Day and week plans cover working days only. Choose a Monday to Friday.'],
    ['the same date', { dueDate: '2026-11-09' }, 'Choose a different date.'],
    ['an invalid date', { dueDate: 'soon' }, 'New due date must be a valid date.'],
  ])('BR-15: refuses %s', async (_label, input, message) => {
    const project = await aProject(testDb());
    const item = await aPlanItem(testDb(), await aPlan(testDb(), project.id, { horizon: 'day', periodStart: '2026-11-09' }));

    expect(await movePlanItem(testDb(), project.id, item.id, input)).toEqual({ ok: false, error: { code: 'invalid', fieldErrors: { dueDate: message } } });
  });

  it('BR-15: a month item may move to a weekend date', async () => {
    const project = await aProject(testDb());
    const item = await aPlanItem(testDb(), await aPlan(testDb(), project.id, { horizon: 'month', periodStart: '2026-11-01' }));

    expect((await movePlanItem(testDb(), project.id, item.id, { dueDate: '2026-12-05' })).ok).toBe(true);
  });

  it('refuses to move a done item or an unknown one', async () => {
    const project = await aProject(testDb());
    const item = await aPlanItem(testDb(), await aPlan(testDb(), project.id), { status: 'done', completedOn: '2026-11-09' });

    expect((await movePlanItem(testDb(), project.id, item.id, { dueDate: '2026-11-12' })).ok).toBe(false);
    expect(await movePlanItem(testDb(), project.id, 'bad', { dueDate: '2026-11-12' })).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await movePlanItem(testDb(), project.id, project.id, { dueDate: '2026-11-12' })).toEqual({ ok: false, error: { code: 'not_found' } });
  });
});

describe('plan view', () => {
  it('shows an empty, not-yet-created plan for any date in the period', async () => {
    const project = await aProject(testDb());

    expect(await getPlan(testDb(), project.id, 'week', d('2026-11-11'), today)).toEqual({
      horizon: 'week',
      period: { start: '2026-11-09', end: '2026-11-13' },
      label: 'Week of 9–13 Nov 2026',
      items: [],
    });
    expect(await getPlan(testDb(), project.id, 'day', d('2026-11-14'), today)).toBeNull();
  });

  it('BR-36: deletes an item', async () => {
    const project = await aProject(testDb());
    const item = await aPlanItem(testDb(), await aPlan(testDb(), project.id));

    expect(await deletePlanItem(testDb(), project.id, item.id)).toEqual({ ok: true, value: null });
    expect(await deletePlanItem(testDb(), project.id, item.id)).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await deletePlanItem(testDb(), project.id, 'bad')).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await getPlanItem(testDb(), project.id, 'bad', today)).toBeNull();
  });
});

describe('open plan items', () => {
  it('lists unfinished items soonest first, with a limit', async () => {
    const project = await aProject(testDb());
    const plan = await aPlan(testDb(), project.id, { horizon: 'month', periodStart: '2026-11-01' });
    await aPlanItem(testDb(), plan, { title: 'later', dueDate: '2026-11-20' });
    await aPlanItem(testDb(), plan, { title: 'sooner', dueDate: '2026-11-05' });
    await aPlanItem(testDb(), plan, { title: 'done', status: 'done', completedOn: '2026-11-02' });

    expect((await listOpenPlanItems(testDb(), project.id, today)).map((i) => i.title)).toEqual(['sooner', 'later']);
    expect(await listOpenPlanItems(testDb(), project.id, today, 1)).toHaveLength(1);
  });
});
