import 'server-only';
import type { Db } from '#src/server/db/client.ts';
import type { IsoDate } from '#src/server/domain/calendar.ts';
import { log } from '#src/server/log.ts';
import { renderMarkdown } from '#src/server/reports/render-markdown.ts';
import { renderPdf, reportFileName } from '#src/server/reports/render-pdf.ts';
import { buildReport, parseReportRequest } from '#src/server/reports/report.ts';

export type ExportDeps = {
  readonly db: Db;
  /** The adapter's own session check (NF-05). */
  readonly isSignedIn: boolean;
  readonly projectId: string;
  readonly today: IsoDate;
  readonly author: string;
};

const noStore = { 'Cache-Control': 'no-store' } as const;

function plain(status: number, message: string): Response {
  return new Response(message, { status, headers: { ...noStore, 'Content-Type': 'text/plain; charset=utf-8' } });
}

/**
 * GET /projects/{projectId}/reports/export?kind=weekly&start=2026-11-09&format=pdf|md
 * session → validate → load → build → render (docs/02 §9).
 */
export async function exportReport(request: Request, deps: ExportDeps): Promise<Response> {
  if (!deps.isSignedIn) {
    return new Response(null, { status: 303, headers: { ...noStore, Location: '/sign-in' } });
  }
  const params = new URL(request.url).searchParams;
  const format = params.get('format');
  const parsed = parseReportRequest({ kind: params.get('kind'), start: params.get('start') });
  if (!parsed.ok || (format !== 'pdf' && format !== 'md')) {
    return plain(400, 'Choose a report type, a valid period start and a format (pdf or md).');
  }
  const started = Date.now();
  const model = await buildReport(deps.db, deps.projectId, parsed.value, { today: deps.today, author: deps.author });
  if (model === null) {
    return plain(404, 'Project not found.');
  }
  const body = format === 'pdf' ? await renderPdf(model) : new TextEncoder().encode(renderMarkdown(model));
  log('info', 'report.exported', { kind: model.kind, format, ms: Date.now() - started });
  return new Response(body.slice().buffer, {
    status: 200,
    headers: {
      ...noStore,
      'Content-Type': format === 'pdf' ? 'application/pdf' : 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${reportFileName(model, format)}"`,
    },
  });
}
