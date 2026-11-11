import type { Brand } from '#src/lib/brand.ts';

/** A valid calendar date `YYYY-MM-DD`, without time or zone (BR-01). */
export type IsoDate = Brand<string, 'IsoDate'>;

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const dayMs = 86_400_000;

/** Returns the date if `value` is a real calendar date in `YYYY-MM-DD` form, else `null`. */
export function parseIsoDate(value: string): IsoDate | null {
  if (!isoDatePattern.test(value)) {
    return null;
  }
  const { year, month, day } = numericParts(value);
  // Rejects 2026-02-30 and friends: Date.UTC silently rolls them over.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1000 || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    return null;
  }
  return value as IsoDate; // the brand constructor: validated above
}

/** For literals in code and tests. Throws on an invalid date, so never use it on input. */
export function isoDate(value: string): IsoDate {
  const parsed = parseIsoDate(value);
  if (parsed === null) {
    throw new Error(`Not a valid date: ${value}`);
  }
  return parsed;
}

// docs/02 §6.3: arithmetic happens in UTC on the date parts, so DST and server zone cannot matter.
function toUtcMs(date: IsoDate): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10) as IsoDate; // always a valid date
}

/** BR-02: today's date in the app time zone, from an explicit clock. */
export function today(now: Date, timeZone: string): IsoDate {
  // The en-CA calendar format is YYYY-MM-DD; isoDate() would throw if that ever changed.
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return isoDate(formatted);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMs(date) + days * dayMs);
}

/** Calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / dayMs);
}

export function weekday(date: IsoDate): Weekday {
  const day = new Date(toUtcMs(date)).getUTCDay();
  return (day === 0 ? 7 : day) as Weekday; // getUTCDay is 0–6
}

/** BR-03: Monday to Friday. */
export function isWorkingDay(date: IsoDate): boolean {
  return weekday(date) <= 5;
}

/** BR-04: the first Monday–Friday date strictly after `date`. */
export function nextWorkingDay(date: IsoDate): IsoDate {
  let next = addDays(date, 1);
  while (!isWorkingDay(next)) {
    next = addDays(next, 1);
  }
  return next;
}

/** The Monday of the ISO week containing `date`. */
export function weekStart(date: IsoDate): IsoDate {
  return addDays(date, 1 - weekday(date));
}

export function monthStart(date: IsoDate): IsoDate {
  return isoDate(`${date.slice(0, 8)}01`);
}

export function monthEnd(date: IsoDate): IsoDate {
  const { year, month } = numericParts(date);
  return fromUtcMs(Date.UTC(year, month, 0)); // day 0 of the next month
}

/** Every date from `start` to `end`, inclusive. */
export function datesBetween(start: IsoDate, end: IsoDate): readonly IsoDate[] {
  const dates: IsoDate[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

type Parts = { readonly year: number; readonly month: number; readonly day: number };

function numericParts(date: string): Parts {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)) };
}

function utcFormat(options: Intl.DateTimeFormatOptions): (date: IsoDate) => string {
  const format = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' });
  return (date) => format.format(toUtcMs(date));
}

const parts = numericParts;
const shortMonthOf = utcFormat({ month: 'short' });
const longMonthOf = utcFormat({ month: 'long' });

/** "Monday" */
export const dayName = utcFormat({ weekday: 'long' });

/** "10 Nov 2026" */
export function formatDate(date: IsoDate): string {
  const { year, day } = parts(date);
  return `${String(day)} ${shortMonthOf(date)} ${String(year)}`;
}

/** "Tue 10 Nov" — compact, for lists within a known year. */
export function formatShortDate(date: IsoDate): string {
  return `${dayName(date).slice(0, 3)} ${String(parts(date).day)} ${shortMonthOf(date)}`;
}

/** "Tuesday 10 Nov 2026" */
export function dayLabel(date: IsoDate): string {
  return `${dayName(date)} ${formatDate(date)}`;
}

/** "9–13 Nov 2026", "30 Nov – 4 Dec 2026", "29 Dec 2025 – 2 Jan 2026" */
export function rangeLabel(start: IsoDate, end: IsoDate): string {
  const a = parts(start);
  const b = parts(end);
  if (a.year !== b.year) {
    return `${formatDate(start)} – ${formatDate(end)}`;
  }
  if (a.month !== b.month) {
    return `${String(a.day)} ${shortMonthOf(start)} – ${formatDate(end)}`;
  }
  return `${String(a.day)}–${formatDate(end)}`;
}

/** "November 2026" */
export function monthLabel(date: IsoDate): string {
  return `${longMonthOf(date)} ${String(parts(date).year)}`;
}
