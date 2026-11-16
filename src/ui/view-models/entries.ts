import type { PullRequestVM } from './common.ts';

export type EntryVM = {
  readonly id: string;
  readonly date: string;
  readonly dateLabel: string;
  readonly isWeekend: boolean;
  readonly description: string;
  readonly area: string | null;
  readonly people: readonly string[];
  /** BR-46 */
  readonly pullRequests: readonly PullRequestVM[];
  /** BR-17: any number of each; BR-44/BR-45: what this entry closed. */
  readonly planItems: readonly EntryPlanItemLinkVM[];
  readonly issues: readonly EntryIssueLinkVM[];
};

/** BR-45 */
export type EntryPlanItemLinkVM = { readonly id: string; readonly title: string; readonly completes: boolean };

/** BR-44: short summaries; the full story is on the pull requests. */
export type EntryIssueLinkVM = {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly cause: string;
  readonly fix: string;
  readonly resolves: boolean;
};

/** Values to prefill the entry form when editing. */
export type EntryFormValues = {
  readonly workDate: string;
  readonly description: string;
  readonly areaId: string;
  readonly personIds: readonly string[];
  /** BR-46: one link per line. */
  readonly prUrls: string;
  /** Linked already — offered even when no longer open, so editing never drops a link. */
  readonly planItems: readonly EntryPlanItemLinkVM[];
  readonly issues: readonly EntryIssueLinkVM[];
};

export type LogDayVM = { readonly date: string; readonly label: string; readonly isWeekend: boolean; readonly entries: readonly EntryVM[] };

export type LogVM = {
  readonly days: readonly LogDayVM[];
  readonly filters: { readonly areaId: string; readonly personId: string; readonly pullRequestId: string; readonly issueId: string; readonly planItemId: string };
  readonly isFiltered: boolean;
  /** Query string for the next page, or null at the end. */
  readonly nextPageQuery: string | null;
};
