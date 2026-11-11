import { describe, expect, it } from 'vitest';
import { isoDate as d, today } from './calendar.ts';
import { issueDeadline, openDeadline } from './deadlines.ts';
import { planStartFor } from './plans.ts';

/* docs/04 §4.2: what the app shows at the edges of the day, week, month and year. */

const kampala = 'Africa/Kampala';
const at = (iso: string) => today(new Date(iso), kampala);

describe('clock scenarios in Africa/Kampala (UTC+3)', () => {
  it.each([
    ['2026-11-10T20:59:00Z', '2026-11-10'],
    ['2026-11-10T21:00:00Z', '2026-11-11'],
    ['2026-11-10T21:01:00Z', '2026-11-11'],
  ])('BR-02: at %s UTC, today is %s', (instant, expected) => {
    expect(at(instant)).toBe(expected);
  });

  it('BR-13: an item due Friday turns overdue exactly at Monday 00:00 in Kampala (Sunday 21:00 UTC)', () => {
    const due = d('2026-11-13');

    expect(openDeadline(due, at('2026-11-15T20:59:59Z')).state).toBe('due_soon');
    expect(openDeadline(due, at('2026-11-15T21:00:00Z')).state).toBe('overdue');
  });

  it('BR-14: Friday evening, Monday is the next working day — due soon', () => {
    expect(openDeadline(d('2026-11-16'), at('2026-11-13T18:00:00Z')).label).toBe('Due in 3 days');
    expect(openDeadline(d('2026-11-16'), at('2026-11-13T18:00:00Z')).state).toBe('due_soon');
  });

  it('BR-02: the month and the year change at Kampala midnight', () => {
    expect(at('2026-11-30T21:00:00Z')).toBe('2026-12-01');
    expect(at('2026-12-31T20:59:59Z')).toBe('2026-12-31');
    expect(at('2026-12-31T21:00:00Z')).toBe('2027-01-01');
    expect(planStartFor('month', at('2026-12-31T21:00:00Z'))).toEqual({ ok: true, value: '2027-01-01' });
  });

  it('BR-31: leap day deadlines count calendar days correctly', () => {
    expect(at('2028-02-28T21:00:00Z')).toBe('2028-02-29');
    expect(issueDeadline({ deadline: d('2028-02-28'), resolvedOn: d('2028-03-01') }, d('2028-03-02')).label).toBe('Resolved 2 days late');
  });

  it('BR-02: a server running in UTC and one in Los Angeles agree on today', () => {
    const instant = new Date('2026-11-10T22:30:00Z');

    expect(today(instant, kampala)).toBe('2026-11-11');
    expect(today(instant, 'UTC')).toBe('2026-11-10');
    expect(today(instant, 'Pacific/Kiritimati')).toBe('2026-11-11');
  });
});
