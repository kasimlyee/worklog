import type { Metadata } from 'next';
import { appDatabase, appToday } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { saveReportNoteAction } from '#src/server/actions/notes.ts';
import { parseIsoDate } from '#src/server/domain/calendar.ts';
import { reportKinds, reportStartFor, shiftReportPeriod, type ReportKind } from '#src/server/domain/report-periods.ts';
import { env } from '#src/server/env.ts';
import { buildReport } from '#src/server/reports/report.ts';
import { getReportNote } from '#src/server/services/report-notes.ts';
import { ReportsScreen } from '#src/ui/components/reports-screen.tsx';
import { projectHref } from '#src/ui/routes.ts';
import { param, requireProject } from '#src/app/_lib/loaders.ts';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Reports' };

function isKind(value: string): value is ReportKind {
  return reportKinds.some((kind) => kind === value);
}

export default async function ReportsPage({ params, searchParams }: PageProps<'/projects/[projectId]/reports'>): Promise<React.JSX.Element> {
  await requireSession();
  const project = await requireProject((await params).projectId);
  const query = await searchParams;
  const today = appToday();
  const requested = param(query, 'kind');
  const kind: ReportKind = isKind(requested) ? requested : 'weekly';
  const start = reportStartFor(kind, parseIsoDate(param(query, 'date')) ?? today);
  const db = appDatabase();
  const [model, note] = await Promise.all([
    buildReport(db, project.id, { kind, start }, { today, author: env().REPORT_AUTHOR_NAME }),
    getReportNote(db, project.id, kind, start),
  ]);
  if (model === null) {
    notFound();
  }
  const exportHref = (format: 'pdf' | 'md'): string => `${projectHref(project.id, 'reports')}/export?kind=${kind}&start=${start}&format=${format}`;
  return (
    <ReportsScreen
      projectId={project.id}
      saveNote={saveReportNoteAction.bind(null, project.id)}
      vm={{
        kind,
        start,
        previousQuery: `kind=${kind}&date=${shiftReportPeriod(kind, start, -1)}`,
        nextQuery: `kind=${kind}&date=${shiftReportPeriod(kind, start, 1)}`,
        pdfHref: exportHref('pdf'),
        markdownHref: exportHref('md'),
        note,
        model,
      }}
    />
  );
}
