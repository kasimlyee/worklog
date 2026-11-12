import type { StatusVM } from './common.ts';

export type Horizon = 'day' | 'week' | 'month';
export type PlanItemStatus = 'planned' | 'in_progress' | 'done' | 'blocked';

export type MoveVM = { readonly fromLabel: string; readonly toLabel: string; readonly whenLabel: string };

export type PlanItemVM = {
  readonly id: string;
  readonly title: string;
  readonly status: PlanItemStatus;
  readonly statusTag: StatusVM;
  readonly dueDate: string;
  readonly dueLabel: string;
  /** Overdue / due soon / on track — null when done. */
  readonly deadline: StatusVM | null;
  readonly area: string | null;
  readonly assignees: readonly string[];
  readonly issue: string | null;
  readonly issueId: string | null;
  readonly moves: readonly MoveVM[];
};

export type PlanItemFormValues = {
  readonly title: string;
  readonly areaId: string;
  readonly issueId: string;
  readonly personIds: readonly string[];
};

export type PlansVM = {
  readonly horizon: Horizon;
  readonly label: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  /** Plan navigation as `?horizon=…&date=…` query strings. */
  readonly previousQuery: string;
  readonly nextQuery: string;
  readonly currentQuery: string;
  /** False on a weekend for day plans: there is no day plan to add to. */
  readonly canAdd: boolean;
  readonly defaultDueDate: string;
  readonly items: readonly PlanItemVM[];
  /** Week plans: the items under each day, Monday to Friday (empty days included). */
  readonly days: readonly { readonly date: string; readonly label: string; readonly items: readonly PlanItemVM[] }[] | null;
};

export type PlanItemDetailVM = PlanItemVM & { readonly horizon: Horizon; readonly planLabel: string; readonly form: PlanItemFormValues };
