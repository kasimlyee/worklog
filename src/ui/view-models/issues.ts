import type { PullRequestVM, StatusVM } from './common.ts';

export type IssueStatus = 'open' | 'in_progress' | 'resolved';

export type IssueVM = {
  readonly id: string;
  readonly title: string;
  readonly externalUrl: string | null;
  readonly area: string | null;
  readonly assignees: readonly string[];
  readonly status: IssueStatus;
  readonly statusTag: StatusVM;
  readonly assignedLabel: string;
  readonly deadlineLabel: string;
  /** BR-31 deadline state, with its label ("3 days overdue", "Resolved on time"). */
  readonly deadline: StatusVM;
  readonly resolvedOnLabel: string | null;
  readonly resolvedBy: PullRequestVM | null;
};

export type IssueFormValues = {
  readonly title: string;
  readonly externalUrl: string;
  readonly areaId: string;
  readonly personIds: readonly string[];
  readonly assignedOn: string;
  readonly deadline: string;
};

export type IssueDetailVM = IssueVM & { readonly form: IssueFormValues };
