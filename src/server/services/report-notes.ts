import 'server-only';
import * as z from 'zod';
import { ok } from '#src/lib/result.ts';
import type { Db } from '#src/server/db/client.ts';
import type { ReportKind } from '#src/server/db/types.ts';
import type { IsoDate } from '#src/server/domain/calendar.ts';
import { deleteReportNote, selectReportNote, upsertReportNote } from '#src/server/repositories/notes.ts';
import { invalid, parseInput, type ServiceResult } from './errors.ts';
import { oneOf, optionalText, requiredDate } from './fields.ts';
import { isValidReportStart, reportKinds } from './report-request.ts';

export async function getReportNote(db: Db, projectId: string, kind: ReportKind, periodStart: IsoDate): Promise<string> {
  return (await selectReportNote(db, projectId, kind, periodStart)) ?? '';
}

const noteInput = z.object({
  kind: oneOf(reportKinds, 'report type'),
  periodStart: requiredDate('Period'),
  body: optionalText('Report note', 5000),
});

/** R-04: one optional note per report. Saving an empty note removes it. */
export async function saveReportNote(db: Db, projectId: string, input: unknown): Promise<ServiceResult<null>> {
  const parsed = parseInput(noteInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  const { kind, periodStart, body } = parsed.value;
  if (!isValidReportStart(kind, periodStart)) {
    return invalid({ periodStart: 'That is not the start of a report period.' });
  }
  if (body === '') {
    await deleteReportNote(db, projectId, kind, periodStart);
  } else {
    await upsertReportNote(db, projectId, kind, periodStart, body);
  }
  return ok(null);
}
