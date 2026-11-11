import type { PullRequestVM } from './common.ts';

export type EntryVM = {
  readonly id: string;
  readonly date: string;
  readonly dateLabel: string;
  readonly isWeekend: boolean;
  readonly description: string;
  readonly area: string | null;
  readonly people: readonly string[];
  readonly pullRequest: PullRequestVM | null;
  /** BR-17: any number of each. */
  readonly planItems: readonly { readonly id: string; readonly title: string }[];
  readonly issues: readonly { readonly id: string; readonly title: string }[];
};

/** Values to prefill the entry form when editing. */
export type EntryFormValues = {
  readonly workDate: string;
  readonly description: string;
  readonly areaId: string;
  readonly personIds: readonly string[];
  readonly prUrl: string;
  readonly planItemIds: readonly string[];
  readonly issueIds: readonly string[];
};

export type LogDayVM = { readonly date: string; readonly label: string; readonly isWeekend: boolean; readonly entries: readonly EntryVM[] };

export type LogVM = {
  readonly days: readonly LogDayVM[];
  readonly filters: { readonly areaId: string; readonly personId: string; readonly pullRequestId: string };
  readonly isFiltered: boolean;
  /** Query string for the next page, or null at the end. */
  readonly nextPageQuery: string | null;
};
