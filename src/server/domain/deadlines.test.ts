import { describe, expect, it } from 'vitest';
import { isoDate as d } from './calendar.ts';
import { isDueSoon, isOverdue, issueDeadline, openDeadline, overdueFrom, planItemDeadline } from './deadlines.ts';

describe('BR-13: overdue', () => {
  it('BR-13: item due Friday is overdue from the following Monday', () => {
    expect(isOverdue(d('2026-11-13'), d('2026-11-14'))).toBe(false);
    expect(isOverdue(d('2026-11-13'), d('2026-11-15'))).toBe(false);
    expect(isOverdue(d('2026-11-13'), d('2026-11-16'))).toBe(true);
  });

  it('BR-13: item due Tuesday is overdue from Wednesday', () => {
    expect(isOverdue(d('2026-11-10'), d('2026-11-10'))).toBe(false);
    expect(isOverdue(d('2026-11-10'), d('2026-11-11'))).toBe(true);
  });

  it('BR-13: overdueFrom gives the first overdue date', () => {
    expect(overdueFrom(d('2026-11-13'))).toBe('2026-11-16');
  });

  it('BR-13: a done plan item is never overdue', () => {
    expect(planItemDeadline({ status: 'done', dueDate: d('2026-01-01') }, d('2026-11-10'))).toBeNull();
  });

  it('BR-13: a blocked plan item can be overdue', () => {
    expect(planItemDeadline({ status: 'blocked', dueDate: d('2026-11-09') }, d('2026-11-10'))).toEqual({
      state: 'overdue',
      label: '1 day overdue',
    });
  });
});

describe('BR-14: due soon', () => {
  it('BR-14: due today is due soon', () => {
    expect(isDueSoon(d('2026-11-10'), d('2026-11-10'))).toBe(true);
  });

  it('BR-14: due on the next working day is due soon (Friday → Monday)', () => {
    expect(isDueSoon(d('2026-11-16'), d('2026-11-13'))).toBe(true);
    expect(isDueSoon(d('2026-11-17'), d('2026-11-13'))).toBe(false);
  });

  it('BR-14: due Friday, seen on Saturday, is still due soon rather than overdue', () => {
    expect(openDeadline(d('2026-11-13'), d('2026-11-14'))).toEqual({ state: 'due_soon', label: 'Due yesterday' });
    expect(openDeadline(d('2026-11-13'), d('2026-11-15'))).toEqual({ state: 'due_soon', label: 'Was due 2 days ago' });
  });

  it('BR-14: overdue items are not due soon', () => {
    expect(isDueSoon(d('2026-11-09'), d('2026-11-10'))).toBe(false);
  });
});

describe('BR-31: issue deadline states', () => {
  const today = d('2026-11-10');

  it('BR-31: overdue by the BR-13 rule, with calendar-day count', () => {
    expect(issueDeadline({ deadline: d('2026-11-06'), resolvedOn: null }, d('2026-11-09'))).toEqual({
      state: 'overdue',
      label: '3 days overdue',
    });
  });

  it('BR-31: due soon today and tomorrow', () => {
    expect(issueDeadline({ deadline: today, resolvedOn: null }, today)).toEqual({ state: 'due_soon', label: 'Due today' });
    expect(issueDeadline({ deadline: d('2026-11-11'), resolvedOn: null }, today)).toEqual({
      state: 'due_soon',
      label: 'Due tomorrow',
    });
  });

  it('BR-31: on track otherwise, with days to go', () => {
    expect(issueDeadline({ deadline: d('2026-11-16'), resolvedOn: null }, today)).toEqual({
      state: 'on_track',
      label: 'Due in 6 days',
    });
  });

  it('BR-31: resolved on or before the deadline is on time', () => {
    expect(issueDeadline({ deadline: today, resolvedOn: today }, today)).toEqual({ state: 'on_time', label: 'Resolved on time' });
    expect(issueDeadline({ deadline: today, resolvedOn: d('2026-11-01') }, today).state).toBe('on_time');
  });

  it('BR-31: resolved after the deadline is late, counting calendar days', () => {
    expect(issueDeadline({ deadline: d('2026-11-06'), resolvedOn: d('2026-11-08') }, today)).toEqual({
      state: 'late',
      label: 'Resolved 2 days late',
    });
    expect(issueDeadline({ deadline: d('2026-11-06'), resolvedOn: d('2026-11-07') }, today).label).toBe(
      'Resolved 1 day late',
    );
  });
});
