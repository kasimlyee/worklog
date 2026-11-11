import { err, ok, type Result } from '#src/lib/result.ts';
import {
  addDays, dayLabel, isWorkingDay, monthEnd, monthLabel, monthStart, rangeLabel, weekStart, weekday,
  type IsoDate,
} from './calendar.ts';

export type Horizon = 'day' | 'week' | 'month';
export const horizons: readonly Horizon[] = ['day', 'week', 'month'];

export type Period = { readonly start: IsoDate; readonly end: IsoDate };

type PeriodRule = {
  readonly isValidStart: (start: IsoDate) => boolean;
  readonly end: (start: IsoDate) => IsoDate;
  readonly startFor: (date: IsoDate) => IsoDate;
  readonly label: (start: IsoDate) => string;
  readonly shift: (start: IsoDate, direction: 1 | -1) => IsoDate;
};

function nextWorkingDayInDirection(date: IsoDate, direction: 1 | -1): IsoDate {
  let next = addDays(date, direction);
  while (!isWorkingDay(next)) {
    next = addDays(next, direction);
  }
  return next;
}

// BR-08. One table instead of a switch per function: a new horizon cannot be half-handled.
const periodRules: Readonly<Record<Horizon, PeriodRule>> = {
  day: {
    isValidStart: isWorkingDay,
    end: (start) => start,
    startFor: (date) => date,
    label: dayLabel,
    shift: nextWorkingDayInDirection,
  },
  week: {
    isValidStart: (start) => weekday(start) === 1,
    end: (start) => addDays(start, 4),
    startFor: weekStart,
    label: (start) => `Week of ${rangeLabel(start, addDays(start, 4))}`,
    shift: (start, direction) => addDays(start, 7 * direction),
  },
  month: {
    isValidStart: (start) => start.endsWith('-01'),
    end: monthEnd,
    startFor: monthStart,
    label: monthLabel,
    shift: (start, direction) => (direction === 1 ? addDays(monthEnd(start), 1) : monthStart(addDays(start, -1))),
  },
};

/** BR-08: whether `start` can begin a plan of this horizon. */
export function isValidPeriodStart(horizon: Horizon, start: IsoDate): boolean {
  return periodRules[horizon].isValidStart(start);
}

/** BR-08: the dates a plan covers. `start` must already be valid for the horizon. */
export function planPeriod(horizon: Horizon, start: IsoDate): Period {
  return { start, end: periodRules[horizon].end(start) };
}

export type PeriodError = { readonly code: 'not_a_working_day' };

/**
 * BR-08, BR-15: the start of the plan of this horizon that covers `date`.
 * Day and week plans cover working days only, so a weekend date has no such plan.
 */
export function planStartFor(horizon: Horizon, date: IsoDate): Result<IsoDate, PeriodError> {
  if (horizon !== 'month' && !isWorkingDay(date)) {
    return err({ code: 'not_a_working_day' });
  }
  return ok(periodRules[horizon].startFor(date));
}

/** BR-11: a plan item's due date must fall inside its plan's period. */
export function isInPeriod(period: Period, date: IsoDate): boolean {
  return date >= period.start && date <= period.end;
}

/** "Tuesday 10 Nov 2026", "Week of 9–13 Nov 2026", "November 2026" */
export function periodLabel(horizon: Horizon, start: IsoDate): string {
  return periodRules[horizon].label(start);
}

/** The neighbouring period's start, for previous/next navigation. */
export function shiftPeriod(horizon: Horizon, start: IsoDate, direction: 1 | -1): IsoDate {
  return periodRules[horizon].shift(start, direction);
}
