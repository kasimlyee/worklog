import type { StatusVM } from './common.ts';
import type { EntryVM } from './entries.ts';
import type { IssueVM } from './issues.ts';
import type { PlanItemVM } from './plans.ts';

export type TrackedVM = {
  readonly id: string;
  readonly kind: 'plan_item' | 'issue';
  readonly title: string;
  readonly dueLabel: string;
  readonly deadline: StatusVM;
  /** BR-37: shown for high and urgent issues only. */
  readonly priority: StatusVM | null;
  readonly people: readonly string[];
};

/** The numbers at the top of the dashboard: what needs attention, at a glance. */
export type PulseVM = {
  readonly overdue: number;
  readonly dueSoon: number;
  /** Null at the weekend (no day plan). */
  readonly today: { readonly done: number; readonly total: number } | null;
  readonly loggedThisWeek: number;
};

export type DashboardVM = {
  readonly todayLabel: string;
  readonly pulse: PulseVM;
  readonly urgent: readonly TrackedVM[];
  readonly dueSoon: readonly TrackedVM[];
  /** Null on a weekend: there are no day plans. */
  readonly todaysPlan: readonly PlanItemVM[] | null;
  readonly openIssues: readonly IssueVM[];
  readonly recentEntries: readonly EntryVM[];
};
