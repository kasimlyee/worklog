import type { PullRequestVM, StatusVM } from './common.ts';

export type ReleaseVM = {
  readonly id: string;
  readonly version: string;
  readonly status: StatusVM;
  readonly targetLabel: string | null;
  readonly releasedLabel: string | null;
  /** Safe HTML rendered on the server (BR-33). */
  readonly notesHtml: string;
  readonly pullRequests: readonly PullRequestVM[];
};

export type ReleaseFormValues = {
  readonly version: string;
  readonly status: 'planned' | 'released';
  readonly targetDate: string;
  readonly releasedOn: string;
  readonly notes: string;
  readonly pullRequestIds: readonly string[];
};

export type ReleaseDetailVM = ReleaseVM & {
  readonly form: ReleaseFormValues;
  readonly attachedNotes: readonly { readonly id: string; readonly title: string }[];
};
