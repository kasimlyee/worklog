export type ProjectSummaryVM = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Overdue plan items + issues: shown in red when above zero. */
  readonly overdueCount: number;
};

export type ProjectHeaderVM = {
  readonly id: string;
  readonly name: string;
  readonly isArchived: boolean;
  readonly overdueCount: number;
};
