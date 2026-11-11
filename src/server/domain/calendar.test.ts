import { describe, expect, it } from 'vitest';
import {
  addDays, datesBetween, dayLabel, dayName, daysBetween, formatDate, formatShortDate, isWorkingDay, isoDate,
  monthEnd, monthLabel, monthStart, nextWorkingDay, parseIsoDate, rangeLabel, today, weekStart, weekday,
} from './calendar.ts';

const d = isoDate;

describe('parseIsoDate', () => {
  it.each(['2026-11-10', '2024-02-29', '2026-12-31'])('accepts %s', (value) => {
    expect(parseIsoDate(value)).toBe(value);
  });

  it.each(['2026-02-29', '2026-13-01', '2026-11-31', '2026-1-1', '10/11/2026', '', '2026-11-10T00:00', '0999-01-01'])(
    'rejects %s',
    (value) => {
      expect(parseIsoDate(value)).toBeNull();
    },
  );

  it('isoDate throws on an invalid literal', () => {
    expect(() => isoDate('2026-02-30')).toThrow('Not a valid date: 2026-02-30');
  });
});

describe('today', () => {
  it('BR-02: uses the app time zone, not the server clock zone, after 21:00 UTC', () => {
    expect(today(new Date('2026-11-10T20:59:59Z'), 'Africa/Kampala')).toBe('2026-11-10');
    expect(today(new Date('2026-11-10T21:00:00Z'), 'Africa/Kampala')).toBe('2026-11-11');
  });

  it('BR-01: works for zones behind UTC too', () => {
    expect(today(new Date('2026-11-10T05:00:00Z'), 'America/Los_Angeles')).toBe('2026-11-09');
  });
});

describe('date arithmetic', () => {
  it('adds and subtracts days across month and year ends', () => {
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(d('2024-03-01'), -1)).toBe('2024-02-29');
  });

  it('counts calendar days between dates in either direction', () => {
    expect(daysBetween(d('2026-11-06'), d('2026-11-09'))).toBe(3);
    expect(daysBetween(d('2026-11-09'), d('2026-11-06'))).toBe(-3);
  });

  it('is unaffected by a daylight-saving change', () => {
    expect(daysBetween(d('2026-03-28'), d('2026-03-30'))).toBe(2);
  });

  it('gives ISO weekdays, Monday = 1 and Sunday = 7', () => {
    expect(weekday(d('2026-11-09'))).toBe(1);
    expect(weekday(d('2026-11-15'))).toBe(7);
    expect(dayName(d('2026-11-14'))).toBe('Saturday');
  });

  it('lists every date in a range inclusively', () => {
    expect(datesBetween(d('2026-11-30'), d('2026-12-02'))).toEqual(['2026-11-30', '2026-12-01', '2026-12-02']);
  });
});

describe('working days', () => {
  it('BR-03: Monday to Friday are working days, weekends are not', () => {
    expect(isWorkingDay(d('2026-11-13'))).toBe(true);
    expect(isWorkingDay(d('2026-11-14'))).toBe(false);
    expect(isWorkingDay(d('2026-11-15'))).toBe(false);
  });

  it.each([
    ['2026-11-10', '2026-11-11', 'Tuesday → Wednesday'],
    ['2026-11-13', '2026-11-16', 'Friday → Monday'],
    ['2026-11-14', '2026-11-16', 'Saturday → Monday'],
    ['2026-11-15', '2026-11-16', 'Sunday → Monday'],
  ])('BR-04: next working day after %s is %s (%s)', (from, expected) => {
    expect(nextWorkingDay(d(from))).toBe(expected);
  });
});

describe('periods', () => {
  it('BR-08: the week starts on Monday', () => {
    expect(weekStart(d('2026-11-15'))).toBe('2026-11-09');
    expect(weekStart(d('2026-11-09'))).toBe('2026-11-09');
    expect(weekStart(d('2027-01-01'))).toBe('2026-12-28');
  });

  it('BR-08: months start on the 1st and end on their last day', () => {
    expect(monthStart(d('2026-11-17'))).toBe('2026-11-01');
    expect(monthEnd(d('2026-11-17'))).toBe('2026-11-30');
    expect(monthEnd(d('2024-02-10'))).toBe('2024-02-29');
    expect(monthEnd(d('2026-12-05'))).toBe('2026-12-31');
  });
});

describe('labels', () => {
  it('formats single dates', () => {
    expect(formatDate(d('2026-11-09'))).toBe('9 Nov 2026');
    expect(formatShortDate(d('2026-11-09'))).toBe('Mon 9 Nov');
    expect(dayLabel(d('2026-11-10'))).toBe('Tuesday 10 Nov 2026');
    expect(monthLabel(d('2026-11-10'))).toBe('November 2026');
  });

  it('R-03: formats ranges within a month, across months and across years', () => {
    expect(rangeLabel(d('2026-11-09'), d('2026-11-13'))).toBe('9–13 Nov 2026');
    expect(rangeLabel(d('2026-11-30'), d('2026-12-04'))).toBe('30 Nov – 4 Dec 2026');
    expect(rangeLabel(d('2025-12-29'), d('2026-01-02'))).toBe('29 Dec 2025 – 2 Jan 2026');
  });
});
