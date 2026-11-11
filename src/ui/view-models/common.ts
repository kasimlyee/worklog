/* Shapes shared by every screen. The UI never imports server code: these are its contract. */

/** Product spec §5: semantic colour plus a text label — never colour alone. */
export type Tone = 'success' | 'warning' | 'danger' | 'neutral';
export type StatusVM = { readonly tone: Tone; readonly label: string };

export type Option = { readonly value: string; readonly label: string };

export type PullRequestVM = {
  readonly id: string;
  readonly number: number;
  readonly repo: string;
  readonly title: string;
  readonly url: string;
  readonly state: StatusVM;
};

/** The option lists a project's forms choose from (archived items left out). */
export type Pickers = {
  readonly areas: readonly Option[];
  readonly people: readonly Option[];
  readonly planItems: readonly Option[];
  readonly issues: readonly Option[];
  readonly pullRequests: readonly Option[];
  readonly releases: readonly Option[];
};
