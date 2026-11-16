import 'server-only';
import type { Db } from '#src/server/db/client.ts';
import type { IssuePriority } from '#src/server/db/types.ts';
import { addDays, isWorkingDay, nextWorkingDay, type IsoDate } from '#src/server/domain/calendar.ts';
import { openDeadline, overdueCutoff, type Deadline, type DeadlineState } from '#src/server/domain/deadlines.ts';
import type { NamedRef } from '#src/server/repositories/entries.ts';
import {
  selectOpenIssuesAcrossProjects, selectOpenPlanItemsAcrossProjects, selectRecentlyDone, selectTodayProgress, selectWorkload,
  type DoneRow, type WorkloadRow,
} from '#src/server/repositories/overview.ts';
import { listProjectSummaries, type ProjectSummary } from './dashboard.ts';

export type OverviewItem = {
  readonly kind: 'plan_item' | 'issue';
  readonly id: string;
  readonly title: string;
  readonly project: { readonly id: string; readonly name: string };
  readonly due: IsoDate;
  readonly deadline: Deadline<DeadlineState>;
  /** Issues only (BR-37). */
  readonly priority: IssuePriority | null;
  readonly people: readonly NamedRef[];
};

export type Overview = {
  readonly projects: readonly (ProjectSummary & { readonly today: { readonly done: number; readonly total: number } | null })[];
  /** Overdue work and urgent issues across all projects, oldest first. */
  readonly attention: readonly OverviewItem[];
  readonly dueSoon: readonly OverviewItem[];
  /** Plan items done and issues resolved in the last 7 days, newest first. */
  readonly recentlyDone: readonly DoneRow[];
};

const recentDays = 7;
const recentLimit = 15;

/** BR-42: everything that needs attention, across every active project — five queries. */
export async function getOverview(db: Db, today: IsoDate): Promise<Overview> {
  const horizon = nextWorkingDay(today);
  const [projects, items, issues, done, progress] = await Promise.all([
    listProjectSummaries(db, today),
    selectOpenPlanItemsAcrossProjects(db, horizon),
    selectOpenIssuesAcrossProjects(db, horizon),
    selectRecentlyDone(db, addDays(today, 1 - recentDays), recentLimit),
    isWorkingDay(today) ? selectTodayProgress(db, today) : Promise.resolve(null),
  ]);
  const tracked: OverviewItem[] = [
    ...items.map((row) => ({
      kind: 'plan_item' as const,
      id: row.id,
      title: row.title,
      project: { id: row.projectId, name: row.projectName },
      due: row.dueDate,
      deadline: openDeadline(row.dueDate, today),
      priority: null,
      people: row.assignees,
    })),
    ...issues.map((row) => ({
      kind: 'issue' as const,
      id: row.id,
      title: row.title,
      project: { id: row.projectId, name: row.projectName },
      due: row.deadline,
      deadline: openDeadline(row.deadline, today),
      priority: row.priority,
      people: row.assignees,
    })),
  ].sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  const needsAttention = (item: OverviewItem): boolean => item.deadline.state === 'overdue' || item.priority === 'urgent';
  return {
    projects: projects.map((project) => {
      const row = progress?.find((entry) => entry.projectId === project.id);
      return { ...project, today: progress === null ? null : { done: row?.done ?? 0, total: row?.total ?? 0 } };
    }),
    attention: tracked.filter(needsAttention),
    dueSoon: tracked.filter((item) => !needsAttention(item) && item.deadline.state === 'due_soon'),
    recentlyDone: done,
  };
}

export type Workload = WorkloadRow;

/**
 * BR-43: each person's open, overdue, blocked and recently finished assignments across active
 * projects. Counts of recorded assignments — not a measure of anyone's productivity.
 */
export async function getWorkload(db: Db, today: IsoDate, days = 30): Promise<readonly Workload[]> {
  return await selectWorkload(db, overdueCutoff(today), addDays(today, 1 - days));
}
