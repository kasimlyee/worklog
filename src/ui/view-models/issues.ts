import type { PullRequestVM, StatusVM } from './common.ts';

export type IssueStatus = 'open' | 'in_progress' | 'resolved';
export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';

export type IssueVM = {
  readonly id: string;
  readonly title: string;
  /** BR-27: plain text, line breaks kept; '' when none. */
  readonly description: string;
  readonly externalUrl: string | null;
  readonly area: string | null;
  readonly assignees: readonly string[];
  readonly status: IssueStatus;
  readonly statusTag: StatusVM;
  readonly priority: IssuePriority;
  readonly priorityTag: StatusVM;
  readonly assignedLabel: string;
  readonly deadlineLabel: string;
  /** BR-31 deadline state, with its label ("3 days overdue", "Resolved on time"). */
  readonly deadline: StatusVM;
  readonly resolvedOnLabel: string | null;
  readonly resolvedBy: PullRequestVM | null;
};

export type IssueFormValues = {
  readonly title: string;
  readonly description: string;
  readonly priority: IssuePriority;
  readonly externalUrl: string;
  readonly areaId: string;
  readonly personIds: readonly string[];
  readonly assignedOn: string;
  readonly deadline: string;
};

export type IssueDetailVM = IssueVM & { readonly form: IssueFormValues };

/** The Issues screen's filter and sort, as they are in the URL (BR-37). */
export type IssueListControls = { readonly priority: IssuePriority | ''; readonly sortBy: 'deadline' | 'priority' };
