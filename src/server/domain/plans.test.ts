import { describe, expect, it } from 'vitest';
import { isoDate as d } from './calendar.ts';
import { isInPeriod, isValidPeriodStart, periodLabel, planPeriod, planStartFor, shiftPeriod } from './plans.ts';

describe('plan periods', () => {
  it('BR-08: a day plan starts on a working day', () => {
    expect(isValidPeriodStart('day', d('2026-11-13'))).toBe(true);
    expect(isValidPeriodStart('day', d('2026-11-14'))).toBe(false);
  });

  it('BR-08: a week plan starts on a Monday', () => {
    expect(isValidPeriodStart('week', d('2026-11-09'))).toBe(true);
    expect(isValidPeriodStart('week', d('2026-11-10'))).toBe(false);
  });

  it('BR-08: a month plan starts on the 1st', () => {
    expect(isValidPeriodStart('month', d('2026-11-01'))).toBe(true);
    expect(isValidPeriodStart('month', d('2026-11-02'))).toBe(false);
  });

  it('BR-08: a day covers one day, a week Monday–Friday, a month the calendar month', () => {
    expect(planPeriod('day', d('2026-11-10'))).toEqual({ start: '2026-11-10', end: '2026-11-10' });
    expect(planPeriod('week', d('2026-11-09'))).toEqual({ start: '2026-11-09', end: '2026-11-13' });
    expect(planPeriod('month', d('2026-02-01'))).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('BR-11: due date must be inside the period, inclusive of both ends', () => {
    const week = planPeriod('week', d('2026-11-09'));

    expect(isInPeriod(week, d('2026-11-09'))).toBe(true);
    expect(isInPeriod(week, d('2026-11-13'))).toBe(true);
    expect(isInPeriod(week, d('2026-11-14'))).toBe(false);
    expect(isInPeriod(week, d('2026-11-08'))).toBe(false);
  });
});

describe('planStartFor', () => {
  it('BR-15: finds the plan covering the new due date for each horizon', () => {
    expect(planStartFor('day', d('2026-11-12'))).toEqual({ ok: true, value: '2026-11-12' });
    expect(planStartFor('week', d('2026-11-12'))).toEqual({ ok: true, value: '2026-11-09' });
    expect(planStartFor('month', d('2026-11-15'))).toEqual({ ok: true, value: '2026-11-01' });
  });

  it('BR-15: day and week plans have no weekend dates to move into', () => {
    expect(planStartFor('day', d('2026-11-14'))).toEqual({ ok: false, error: { code: 'not_a_working_day' } });
    expect(planStartFor('week', d('2026-11-15'))).toEqual({ ok: false, error: { code: 'not_a_working_day' } });
  });
});

describe('periodLabel', () => {
  it('R-03: names each kind of period', () => {
    expect(periodLabel('day', d('2026-11-10'))).toBe('Tuesday 10 Nov 2026');
    expect(periodLabel('week', d('2026-11-09'))).toBe('Week of 9–13 Nov 2026');
    expect(periodLabel('month', d('2026-11-01'))).toBe('November 2026');
  });
});

describe('shiftPeriod', () => {
  it('skips weekends between day plans', () => {
    expect(shiftPeriod('day', d('2026-11-13'), 1)).toBe('2026-11-16');
    expect(shiftPeriod('day', d('2026-11-16'), -1)).toBe('2026-11-13');
  });

  it('moves weeks by seven days and months by calendar month', () => {
    expect(shiftPeriod('week', d('2026-11-09'), -1)).toBe('2026-11-02');
    expect(shiftPeriod('month', d('2026-12-01'), 1)).toBe('2027-01-01');
    expect(shiftPeriod('month', d('2026-03-01'), -1)).toBe('2026-02-01');
  });
});
