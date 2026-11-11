import type { PullRequestVM } from './common.ts';

export type NoteLinkVM = { readonly label: string; readonly url: string };

export type NoteVM = {
  readonly id: string;
  readonly title: string;
  /** Safe HTML rendered on the server (BR-33). */
  readonly bodyHtml: string;
  readonly updatedLabel: string;
  readonly release: { readonly id: string; readonly version: string } | null;
  readonly pullRequest: PullRequestVM | null;
  readonly links: readonly NoteLinkVM[];
};

export type NoteFormValues = {
  readonly title: string;
  readonly body: string;
  readonly releaseId: string;
  readonly pullRequestId: string;
  readonly links: readonly NoteLinkVM[];
};
