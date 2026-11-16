import type { ReportKind } from '#src/server/domain/report-periods.ts';

/*
 * The one shape every renderer consumes (R-02): preview, Markdown and PDF never differ
 * in content because none of them decides content.
 */

/** Product spec §5 — colour is never the only signal: every tone travels with its label. */
export type Tone = 'success' | 'warning' | 'danger' | 'neutral';
export type StatusTag = { readonly tone: Tone; readonly label: string };

/** A named value shown in its own table column (e.g. "Deadline": "Fri 13 Nov"). */
export type ReportCell = { readonly label: string; readonly text: string };

/** Where a table column takes its content from (docs/02 D-19). */
export type ReportColumn = {
  readonly label: string;
  readonly from: 'text' | 'tags' | 'people' | { readonly cell: string };
  /** For the text column: show the line's detail on a second line. */
  readonly withDetail?: boolean;
};

export type ReportLine = {
  /** Values for the group's cell columns. */
  readonly cells?: readonly ReportCell[];
  readonly text: string;
  readonly tags: readonly StatusTag[];
  /** Secondary text, e.g. a date or "3 entries". */
  readonly detail: string | null;
  /** R-09: names shown after the item. */
  readonly people: readonly string[];
  readonly children: readonly ReportLine[];
};

export type ReportGroup = {
  readonly title: string | null;
  readonly lines: readonly ReportLine[];
  /** The table's columns; without them: the item (with its detail), status and people. */
  readonly columns?: readonly ReportColumn[];
};

/** A short boxed list beside its neighbour: highlights, what needs attention, goals. */
export type ReportPanel = { readonly title: string; readonly items: readonly string[] };

export type ReportSection = {
  readonly title: string;
  readonly summary: readonly { readonly label: string; readonly value: number }[];
  readonly groups: readonly ReportGroup[];
};

export type ReportModel = {
  readonly kind: ReportKind;
  readonly projectName: string;
  readonly projectSlug: string;
  readonly typeLabel: string;
  /** The big title in the header band, e.g. "Week 46 report". */
  readonly title?: string;
  readonly periodLabel: string;
  readonly periodStart: string;
  readonly author: string;
  readonly generatedLabel: string;
  readonly note: string | null;
  /** Shown when there are no sections; reports say no work was recorded (BR-47: plans differ). */
  readonly emptyMessage?: string;
  /** Shown side by side under the key numbers. */
  readonly panels?: readonly ReportPanel[];
  /** R-08: never contains an empty section. */
  readonly sections: readonly ReportSection[];
};

export const emptyReportMessage = 'No work recorded for this period.';
