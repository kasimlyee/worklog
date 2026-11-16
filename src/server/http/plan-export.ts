import 'server-only';
import { log } from '#src/server/log.ts';
import { buildPlanExportModel, loadPlanExportData, parsePlanExportRequest, planFileName } from '#src/server/reports/plan-export.ts';
import { renderMarkdown } from '#src/server/reports/render-markdown.ts';
import { renderPdf } from '#src/server/reports/render-pdf.ts';
import type { ExportDeps } from './report-export.ts';

const noStore = { 'Cache-Control': 'no-store' } as const;

function plain(status: number, message: string): Response {
  return new Response(message, { status, headers: { ...noStore, 'Content-Type': 'text/plain; charset=utf-8' } });
}

/**
 * BR-47: GET /projects/{projectId}/plans/export?kind=weekly|monthly&start=2026-11-16&format=pdf|md
 * session → validate → load → build → render, as the report export (docs/02 §9).
 */
export async function exportPlan(request: Request, deps: ExportDeps): Promise<Response> {
  if (!deps.isSignedIn) {
    return new Response(null, { status: 303, headers: { ...noStore, Location: '/sign-in' } });
  }
  const params = new URL(request.url).searchParams;
  const format = params.get('format');
  const parsed = parsePlanExportRequest({ kind: params.get('kind'), start: params.get('start') });
  if (!parsed.ok || (format !== 'pdf' && format !== 'md')) {
    return plain(400, 'Choose weekly or monthly, a valid period start and a format (pdf or md).');
  }
  const data = await loadPlanExportData(deps.db, deps.projectId, parsed.value, deps.author);
  if (data === null) {
    return plain(404, 'Project not found.');
  }
  const model = buildPlanExportModel(data, deps.today);
  const body = format === 'pdf' ? await renderPdf(model) : new TextEncoder().encode(renderMarkdown(model));
  log('info', 'plan.exported', { kind: model.kind, format });
  return new Response(body.slice().buffer, {
    status: 200,
    headers: {
      ...noStore,
      'Content-Type': format === 'pdf' ? 'application/pdf' : 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${planFileName(model, format)}"`,
    },
  });
}
