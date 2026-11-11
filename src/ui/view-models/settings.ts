import type { PullRequestVM } from './common.ts';

export type AreaVM = { readonly id: string; readonly name: string; readonly isArchived: boolean };

export type SettingsVM = {
  readonly project: { readonly id: string; readonly name: string; readonly description: string; readonly isArchived: boolean };
  readonly areas: readonly AreaVM[];
};

export type PersonVM = { readonly id: string; readonly name: string; readonly isArchived: boolean };

export type PullRequestRowVM = PullRequestVM & { readonly owner: string };
