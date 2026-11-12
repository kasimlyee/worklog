import 'server-only';
import type { Db } from '#src/server/db/client.ts';
import { isWorkingDay, nextWorkingDay, weekStart, type IsoDate } from '#src/server/domain/calendar.ts';
import { overdueCutoff } from '#src/server/domain/deadlines.ts';
import { selectProjectsWithOverdue } from '#src/server/repositories/dashboard.ts';
import { countEntries, selectEntries } from '#src/server/repositories/entries.ts';
import { selectIssues } from '#src/server/repositories/issues.ts';
import { selectPlanItems } from '#src/server/repositories/plans.ts';
import { toEntry, type Entry } from './entries.ts';
import { toIssue, type Issue } from './issues.ts';
import { toPlanItem, type PlanItem } from './plans.ts';

export type ProjectSummary = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly overdueCount: number;
};

/** Project switcher: every active project with its red overdue count (items + issues). */
export async function listProjectSummaries(db: Db, today: IsoDate): Promise<readonly ProjectSummary[]> {
  const rows = await selectProjectsWithOverdue(db, overdueCutoff(today));
  return rows.map(({ overdueItems, overdueIssues, ...project }) => ({ ...project, overdueCount: overdueItems + overdueIssues }));
}

export type DashboardItem =
  | { readonly kind: 'plan_item'; readonly due: IsoDate; readonly item: PlanItem }
  | { readonly kind: 'issue'; readonly due: IsoDate; readonly issue: Issue };

export type Dashboard = {
  /** Overdue plan items and issues, oldest first. */
  readonly urgent: readonly DashboardItem[];
  readonly dueSoon: readonly DashboardItem[];
  /** Today's day plan; `null` on a weekend, when there is no day plan. */
  readonly todaysPlan: readonly PlanItem[] | null;
  readonly openIssues: readonly Issue[];
  readonly recentEntries: readonly Entry[];
  /** Entries logged from this week's Monday to today. */
  readonly loggedThisWeek: number;
};

const recentEntryCount = 5;

function byDue(a: DashboardItem, b: DashboardItem): number {
  return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
}

/** One call, five queries regardless of data size (NF-01). */
export async function getDashboard(db: Db, projectId: string, today: IsoDate): Promise<Dashboard> {
  const [soonItems, openIssueRows, todayRows, entryRows, loggedThisWeek] = await Promise.all([
    selectPlanItems(db, projectId, { openDueOnOrBefore: nextWorkingDay(today) }),
    selectIssues(db, projectId, { openOnly: true }),
    isWorkingDay(today) ? selectPlanItems(db, projectId, { plan: { horizon: 'day', periodStart: today } }) : Promise.resolve(null),
    selectEntries(db, projectId, { limit: recentEntryCount }),
    countEntries(db, projectId, weekStart(today), today),
  ]);
  const openIssues = openIssueRows.map((row) => toIssue(row, today));
  const tracked: DashboardItem[] = [
    ...soonItems.map((row) => ({ kind: 'plan_item' as const, due: row.dueDate, item: toPlanItem(row, today) })),
    ...openIssues.map((issue) => ({ kind: 'issue' as const, due: issue.deadline, issue })),
  ].sort(byDue);
  const stateOf = (entry: DashboardItem): string | undefined =>
    entry.kind === 'plan_item' ? entry.item.deadline?.state : entry.issue.deadlineState.state;
  // BR-37: an urgent issue is urgent whatever its deadline; it is listed only once.
  const isUrgent = (entry: DashboardItem): boolean =>
    stateOf(entry) === 'overdue' || (entry.kind === 'issue' && entry.issue.priority === 'urgent');
  return {
    urgent: tracked.filter(isUrgent),
    dueSoon: tracked.filter((entry) => !isUrgent(entry) && stateOf(entry) === 'due_soon'),
    todaysPlan: todayRows === null ? null : todayRows.map((row) => toPlanItem(row, today)),
    openIssues,
    recentEntries: entryRows.map(toEntry),
    loggedThisWeek,
  };
}
