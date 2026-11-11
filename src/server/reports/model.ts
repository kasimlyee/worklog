import type { ReportKind } from '#src/server/domain/report-periods.ts';

/*
 * The one shape every renderer consumes (R-02): preview, Markdown and PDF never differ
 * in content because none of them decides content.
 */

/** Product spec §5 — colour is never the only signal: every tone travels with its label. */
export type Tone = 'success' | 'warning' | 'danger' | 'neutral';
export type StatusTag = { readonly tone: Tone; readonly label: string };

export type ReportLine = {
  readonly text: string;
  readonly tags: readonly StatusTag[];
  /** Secondary text, e.g. a date or "3 entries". */
  readonly detail: string | null;
  /** R-09: names shown after the item. */
  readonly people: readonly string[];
  readonly children: readonly ReportLine[];
};

export type ReportGroup = { readonly title: string | null; readonly lines: readonly ReportLine[] };

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
  readonly periodLabel: string;
  readonly periodStart: string;
  readonly author: string;
  readonly generatedLabel: string;
  readonly note: string | null;
  /** R-08: never contains an empty section. */
  readonly sections: readonly ReportSection[];
};

export const emptyReportMessage = 'No work recorded for this period.';
