import { addDays, daysBetween, isWorkingDay, nextWorkingDay, type IsoDate } from './calendar.ts';

export type DeadlineState = 'overdue' | 'due_soon' | 'on_track';
export type IssueDeadlineState = DeadlineState | 'on_time' | 'late';

export type Deadline<S extends string> = { readonly state: S; readonly label: string };

function plural(count: number, unit: string): string {
  return `${String(count)} ${unit}${count === 1 ? '' : 's'}`;
}

/** BR-13: overdue from the next working day after the due date. Only call for unfinished work. */
export function isOverdue(due: IsoDate, today: IsoDate): boolean {
  return today >= nextWorkingDay(due);
}

/**
 * BR-14: due soon when the due date is today or the next working day.
 * A due date already passed but still within its grace period (due Friday, today
 * Saturday) is also due soon: it is not yet overdue, and "on track" would be wrong.
 */
export function isDueSoon(due: IsoDate, today: IsoDate): boolean {
  return !isOverdue(due, today) && due <= nextWorkingDay(today);
}

function dueLabel(due: IsoDate, today: IsoDate): string {
  const days = daysBetween(today, due);
  if (days === 0) {
    return 'Due today';
  }
  if (days === 1) {
    return 'Due tomorrow';
  }
  if (days === -1) {
    return 'Due yesterday';
  }
  return days > 0 ? `Due in ${plural(days, 'day')}` : `Was due ${plural(-days, 'day')} ago`;
}

/** Deadline state and label of unfinished work (BR-13, BR-14, BR-31). Day counts are calendar days. */
export function openDeadline(due: IsoDate, today: IsoDate): Deadline<DeadlineState> {
  if (isOverdue(due, today)) {
    return { state: 'overdue', label: `${plural(daysBetween(due, today), 'day')} overdue` };
  }
  return { state: isDueSoon(due, today) ? 'due_soon' : 'on_track', label: dueLabel(due, today) };
}

/** BR-13/BR-14 for a plan item: `null` when done (done work has no deadline state). */
export function planItemDeadline(
  item: { readonly status: string; readonly dueDate: IsoDate },
  today: IsoDate,
): Deadline<DeadlineState> | null {
  return item.status === 'done' ? null : openDeadline(item.dueDate, today);
}

/** BR-31: the deadline state of an issue. */
export function issueDeadline(
  issue: { readonly deadline: IsoDate; readonly resolvedOn: IsoDate | null },
  today: IsoDate,
): Deadline<IssueDeadlineState> {
  if (issue.resolvedOn === null) {
    return openDeadline(issue.deadline, today);
  }
  const late = daysBetween(issue.deadline, issue.resolvedOn);
  return late <= 0
    ? { state: 'on_time', label: 'Resolved on time' }
    : { state: 'late', label: `Resolved ${plural(late, 'day')} late` };
}

/** The date an unfinished item with this due date first counts as overdue (BR-13). */
export function overdueFrom(due: IsoDate): IsoDate {
  return nextWorkingDay(due);
}

/**
 * BR-13 as a query bound: unfinished work is overdue exactly when its due date is before
 * this date (the last working day on or before today). Lets SQL filter with an index.
 */
export function overdueCutoff(today: IsoDate): IsoDate {
  let date = today;
  while (!isWorkingDay(date)) {
    date = addDays(date, -1);
  }
  return date;
}
