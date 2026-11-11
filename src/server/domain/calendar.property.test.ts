import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isWorkingDay, isoDate, monthEnd, monthStart, nextWorkingDay, weekStart, weekday, type IsoDate } from './calendar.ts';
import { isDueSoon, isOverdue, openDeadline, overdueCutoff, planItemDeadline } from './deadlines.ts';
import { parsePullRequestUrl } from './pull-request-url.ts';

/* docs/04 §4.1: properties that must hold for every date, not just the examples. */

const anyDate: fc.Arbitrary<IsoDate> = fc
  .date({ min: new Date('1990-01-01T00:00:00Z'), max: new Date('2100-12-31T00:00:00Z'), noInvalidDate: true })
  .map((date) => isoDate(date.toISOString().slice(0, 10)));

describe('calendar properties', () => {
  it('BR-04: the next working day is a weekday, strictly later and at most 3 days later', () => {
    fc.assert(
      fc.property(anyDate, (date) => {
        const next = nextWorkingDay(date);
        const gap = daysBetween(date, next);
        return isWorkingDay(next) && gap >= 1 && gap <= 3;
      }),
    );
  });

  it('BR-08: the week starts on a Monday on or before the date, within 6 days', () => {
    fc.assert(
      fc.property(anyDate, (date) => {
        const start = weekStart(date);
        return weekday(start) === 1 && start <= date && daysBetween(start, date) <= 6;
      }),
    );
  });

  it('BR-08: month periods tile the calendar with no gaps or overlaps', () => {
    fc.assert(
      fc.property(anyDate, (date) => {
        const start = monthStart(date);
        const end = monthEnd(date);
        return start <= date && date <= end && monthStart(addDays(end, 1)) === addDays(end, 1) && monthEnd(addDays(start, -1)) === addDays(start, -1);
      }),
    );
  });

  it('adding and subtracting days are inverses', () => {
    fc.assert(fc.property(anyDate, fc.integer({ min: -2000, max: 2000 }), (date, days) => addDays(addDays(date, days), -days) === date));
  });
});

describe('deadline properties', () => {
  it('BR-13, BR-14: overdue and due soon are mutually exclusive', () => {
    fc.assert(fc.property(anyDate, anyDate, (due, today) => !(isOverdue(due, today) && isDueSoon(due, today))));
  });

  it('BR-13: a done item is never overdue', () => {
    fc.assert(fc.property(anyDate, anyDate, (dueDate, today) => planItemDeadline({ status: 'done', dueDate }, today) === null));
  });

  it('BR-15: moving a due date later never makes an item more overdue', () => {
    const rank = { overdue: 2, due_soon: 1, on_track: 0 } as const;
    fc.assert(
      fc.property(anyDate, anyDate, fc.integer({ min: 0, max: 60 }), (due, today, delay) => {
        return rank[openDeadline(addDays(due, delay), today).state] <= rank[openDeadline(due, today).state];
      }),
    );
  });

  it('BR-13: the SQL cutoff agrees with isOverdue for every pair of dates', () => {
    fc.assert(fc.property(anyDate, anyDate, (due, today) => (due < overdueCutoff(today)) === isOverdue(due, today)));
  });
});

describe('PR URL properties', () => {
  it('BR-21: never accepts a URL whose host is not exactly github.com', () => {
    fc.assert(
      fc.property(fc.webUrl({ withQueryParameters: true, withFragments: true }), (url) => {
        const result = parsePullRequestUrl(url, ['acme']);
        return !result.ok || new URL(url).host === 'github.com';
      }),
    );
  });

  it('BR-21: never accepts a lookalike host built around github.com', () => {
    fc.assert(
      fc.property(fc.domain(), fc.constantFrom('', '.', '@', ':443', '%2F'), (domain, joiner) => {
        const url = `https://github.com${joiner}${domain}/acme/app/pull/1`;
        return !parsePullRequestUrl(url, ['acme']).ok || joiner === '';
      }),
    );
  });
});

describe('time-zone independence', () => {
  it('BR-01: calendar results do not depend on the process time zone', () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBeTypeOf('number');
    fc.assert(fc.property(anyDate, (date) => weekday(date) === ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1));
  });
});
