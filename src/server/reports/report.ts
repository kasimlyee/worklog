import 'server-only';
import * as z from 'zod';
import { err, ok, type Result } from '#src/lib/result.ts';
import type { Db } from '#src/server/db/client.ts';
import { parseIsoDate, type IsoDate } from '#src/server/domain/calendar.ts';
import { isValidReportStart, reportKinds, type ReportKind } from '#src/server/domain/report-periods.ts';
import { buildReportModel } from './build.ts';
import { loadReportData } from './load.ts';
import type { ReportModel } from './model.ts';

export type ReportRequest = { readonly kind: ReportKind; readonly start: IsoDate };

const requestSchema = z.object({ kind: z.enum(reportKinds), start: z.string().max(10) });

/** docs/02 §9: the request is validated before anything is loaded. */
export function parseReportRequest(input: unknown): Result<ReportRequest, 'invalid_request'> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return err('invalid_request');
  }
  const start = parseIsoDate(parsed.data.start);
  if (start === null || !isValidReportStart(parsed.data.kind, start)) {
    return err('invalid_request');
  }
  return ok({ kind: parsed.data.kind, start });
}

/** load → build. `null` when the project does not exist. */
export async function buildReport(
  db: Db,
  projectId: string,
  request: ReportRequest,
  context: { readonly today: IsoDate; readonly author: string },
): Promise<ReportModel | null> {
  const data = await loadReportData(db, { projectId, ...request, ...context });
  return data === null ? null : buildReportModel(data, context.today);
}
