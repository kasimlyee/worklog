import { addDays, dayLabel, monthEnd, monthLabel, weekStart, monthStart, weekday, type IsoDate } from './calendar.ts';
import { periodLabel } from './plans.ts';

export type ReportKind = 'daily' | 'weekly' | 'monthly';
export const reportKinds = ['daily', 'weekly', 'monthly'] as const satisfies readonly ReportKind[];

type ReportPeriodRule = {
  readonly isValidStart: (start: IsoDate) => boolean;
  readonly startFor: (date: IsoDate) => IsoDate;
  /** Calendar dates covered. A week runs Monday–Sunday so weekend work can appear (spec §7.3). */
  readonly end: (start: IsoDate) => IsoDate;
  readonly label: (start: IsoDate) => string;
  readonly shift: (start: IsoDate, direction: 1 | -1) => IsoDate;
};

const rules: Readonly<Record<ReportKind, ReportPeriodRule>> = {
  daily: {
    isValidStart: () => true,
    startFor: (date) => date,
    end: (start) => start,
    label: dayLabel,
    shift: (start, direction) => addDays(start, direction),
  },
  weekly: {
    isValidStart: (start) => weekday(start) === 1,
    startFor: weekStart,
    end: (start) => addDays(start, 6),
    label: (start) => periodLabel('week', start),
    shift: (start, direction) => addDays(start, 7 * direction),
  },
  monthly: {
    isValidStart: (start) => start.endsWith('-01'),
    startFor: monthStart,
    end: monthEnd,
    label: monthLabel,
    shift: (start, direction) => (direction === 1 ? addDays(monthEnd(start), 1) : monthStart(addDays(start, -1))),
  },
};

/** docs/02 §9: weekly starts on a Monday, monthly on the 1st; daily is any date (BR-18). */
export function isValidReportStart(kind: ReportKind, start: IsoDate): boolean {
  return rules[kind].isValidStart(start);
}

/** The start of the report period of this kind containing `date`. */
export function reportStartFor(kind: ReportKind, date: IsoDate): IsoDate {
  return rules[kind].startFor(date);
}

export function reportRange(kind: ReportKind, start: IsoDate): { readonly from: IsoDate; readonly to: IsoDate } {
  return { from: start, to: rules[kind].end(start) };
}

export function reportPeriodLabel(kind: ReportKind, start: IsoDate): string {
  return rules[kind].label(start);
}

export function shiftReportPeriod(kind: ReportKind, start: IsoDate, direction: 1 | -1): IsoDate {
  return rules[kind].shift(start, direction);
}
