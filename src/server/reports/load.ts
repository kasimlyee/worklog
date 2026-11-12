import 'server-only';
import type { Db } from '#src/server/db/client.ts';
import type { ReportKind } from '#src/server/db/types.ts';
import { addDays, type IsoDate } from '#src/server/domain/calendar.ts';
import { reportRange } from '#src/server/domain/report-periods.ts';
import { overdueCutoff } from '#src/server/domain/deadlines.ts';
import { selectEntries, type EntryRow } from '#src/server/repositories/entries.ts';
import { selectReportNote } from '#src/server/repositories/notes.ts';
import { selectAreas, selectProject } from '#src/server/repositories/projects.ts';
import { selectReleases, type ReleaseRow } from '#src/server/repositories/releases.ts';
import {
  selectReportIssues, selectReportMoves, selectReportPlanItems, type PlanScope, type ReportIssueRow, type ReportMoveRow,
  type ReportPlanItemRow,
} from '#src/server/repositories/reports.ts';

export type ReportData = {
  readonly kind: ReportKind;
  readonly start: IsoDate;
  readonly range: { readonly from: IsoDate; readonly to: IsoDate };
  /** The reference date for "still open and overdue": the period end, or today if earlier. */
  readonly asOf: IsoDate;
  readonly project: { readonly name: string; readonly slug: string };
  readonly author: string;
  readonly note: string;
  readonly areas: readonly { readonly id: string; readonly name: string }[];
  readonly entries: readonly EntryRow[];
  readonly releases: readonly ReleaseRow[];
  readonly issues: readonly ReportIssueRow[];
  readonly planItems: readonly ReportPlanItemRow[];
  readonly moves: readonly ReportMoveRow[];
  readonly overdueItems: readonly ReportPlanItemRow[];
  readonly completedItems: readonly ReportPlanItemRow[];
};

export type ReportRequestData = {
  readonly projectId: string;
  readonly kind: ReportKind;
  readonly start: IsoDate;
  readonly today: IsoDate;
  readonly author: string;
};

function planScopes(kind: ReportKind, start: IsoDate): readonly PlanScope[] {
  switch (kind) {
    case 'daily':
      return [{ horizon: 'day', from: start, to: start }];
    case 'weekly':
      return [
        { horizon: 'week', from: start, to: start },
        { horizon: 'day', from: start, to: addDays(start, 4) },
      ];
    case 'monthly':
      return [{ horizon: 'month', from: start, to: start }];
    default:
      return kind satisfies never;
  }
}

/**
 * NF-02: a fixed number of queries for each kind (9, or 10 for monthly), whatever the
 * data volume. Returns null for an unknown project.
 */
export async function loadReportData(db: Db, request: ReportRequestData): Promise<ReportData | null> {
  const { projectId, kind, start, today } = request;
  const range = reportRange(kind, start);
  const asOf = range.to < today ? range.to : today;
  const scopes = planScopes(kind, start);
  const [project, areas, entries, releases, issues, planItems, moves, overdueItems, note, completedItems] = await Promise.all([
    selectProject(db, projectId),
    selectAreas(db, projectId, true),
    selectEntries(db, projectId, { from: range.from, to: range.to, order: 'oldest' }),
    selectReleases(db, projectId, { releasedBetween: range }),
    selectReportIssues(db, projectId, range, { deadlineBefore: overdueCutoff(asOf), asOf }, kind === 'monthly'),
    selectReportPlanItems(db, projectId, { kind: 'in_plans', scopes }),
    selectReportMoves(db, projectId, scopes),
    selectReportPlanItems(db, projectId, { kind: 'open_overdue', dueBefore: overdueCutoff(asOf), asOf }),
    selectReportNote(db, projectId, kind, start),
    kind === 'monthly'
      ? selectReportPlanItems(db, projectId, { kind: 'completed', from: range.from, to: range.to, horizons: ['week', 'month'] })
      : Promise.resolve([]),
  ]);
  if (project === undefined) {
    return null;
  }
  return {
    kind,
    start,
    range,
    asOf,
    project: { name: project.name, slug: project.slug },
    author: request.author,
    note: note ?? '',
    areas: areas.map((area) => ({ id: area.id, name: area.name })),
    entries,
    releases,
    issues,
    planItems,
    moves,
    overdueItems,
    completedItems,
  };
}
