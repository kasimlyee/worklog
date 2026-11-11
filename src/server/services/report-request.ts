import 'server-only';
import * as z from 'zod';
import type { ReportKind } from '#src/server/db/types.ts';
import { addDays, monthEnd, weekday, type IsoDate } from '#src/server/domain/calendar.ts';
import { oneOf, requiredDate } from './fields.ts';
import { parseInput, type ServiceResult } from './errors.ts';

export const reportKinds = ['daily', 'weekly', 'monthly'] as const satisfies readonly ReportKind[];

export type ReportRequest = { readonly kind: ReportKind; readonly start: IsoDate };

/** docs/02 §9: weekly starts on a Monday, monthly on the 1st; daily is any date (BR-18). */
export function isValidReportStart(kind: ReportKind, start: IsoDate): boolean {
  switch (kind) {
    case 'daily':
      return true;
    case 'weekly':
      return weekday(start) === 1;
    case 'monthly':
      return start.endsWith('-01');
    default:
      return kind satisfies never;
  }
}

/** The calendar dates the report covers. A week runs Monday–Sunday so weekend work can appear (§7.3). */
export function reportRange(request: ReportRequest): { readonly from: IsoDate; readonly to: IsoDate } {
  switch (request.kind) {
    case 'daily':
      return { from: request.start, to: request.start };
    case 'weekly':
      return { from: request.start, to: addDays(request.start, 6) };
    case 'monthly':
      return { from: request.start, to: monthEnd(request.start) };
    default:
      return request.kind satisfies never;
  }
}

const requestInput = z
  .object({ kind: oneOf(reportKinds, 'report type'), start: requiredDate('Period start') })
  .refine((request) => isValidReportStart(request.kind, request.start), {
    message: 'Weekly reports start on a Monday and monthly reports on the 1st.',
    path: ['start'],
  });

export function parseReportRequest(input: unknown): ServiceResult<ReportRequest> {
  return parseInput(requestInput, input);
}
