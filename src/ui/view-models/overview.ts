import type { StatusVM } from './common.ts';
import type { ProjectSummaryVM } from './shell.ts';

/** BR-42: one piece of work, wherever it lives, with the project it belongs to. */
export type OverviewItemVM = {
  readonly key: string;
  readonly kind: 'plan_item' | 'issue';
  readonly id: string;
  readonly title: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly dueLabel: string;
  readonly deadline: StatusVM;
  readonly priority: StatusVM | null;
  readonly people: readonly string[];
};

export type DoneItemVM = {
  readonly key: string;
  readonly kind: 'plan_item' | 'issue';
  readonly id: string;
  readonly title: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly doneLabel: string;
};

export type OverviewProjectVM = ProjectSummaryVM & {
  /** Today's day plan; null at the weekend. */
  readonly today: { readonly done: number; readonly total: number } | null;
};

export type OverviewVM = {
  readonly todayLabel: string;
  readonly projects: readonly OverviewProjectVM[];
  readonly attention: readonly OverviewItemVM[];
  readonly dueSoon: readonly OverviewItemVM[];
  readonly recentlyDone: readonly DoneItemVM[];
};

/** BR-43: a person's recorded assignments across projects (not a productivity score). */
export type WorkloadVM = {
  readonly id: string;
  readonly name: string;
  readonly openItems: number;
  readonly overdueItems: number;
  readonly blockedItems: number;
  readonly openIssues: number;
  readonly overdueIssues: number;
  readonly doneRecently: number;
  readonly projects: readonly string[];
};
