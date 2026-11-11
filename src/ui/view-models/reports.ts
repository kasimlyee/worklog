import type { StatusVM } from './common.ts';

/* Mirrors the server's ReportModel field for field (R-02: the preview renders the same model). */

export type ReportKind = 'daily' | 'weekly' | 'monthly';

export type ReportLineVM = {
  readonly text: string;
  readonly tags: readonly StatusVM[];
  readonly detail: string | null;
  readonly people: readonly string[];
  readonly children: readonly ReportLineVM[];
};

export type ReportSectionVM = {
  readonly title: string;
  readonly summary: readonly { readonly label: string; readonly value: number }[];
  readonly groups: readonly { readonly title: string | null; readonly lines: readonly ReportLineVM[] }[];
};

export type ReportModelVM = {
  readonly projectName: string;
  readonly typeLabel: string;
  readonly periodLabel: string;
  readonly author: string;
  readonly generatedLabel: string;
  readonly note: string | null;
  readonly sections: readonly ReportSectionVM[];
};

export type ReportsVM = {
  readonly kind: ReportKind;
  readonly start: string;
  readonly previousQuery: string;
  readonly nextQuery: string;
  readonly pdfHref: string;
  readonly markdownHref: string;
  readonly note: string;
  readonly model: ReportModelVM;
};
