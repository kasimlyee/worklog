import 'server-only';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import type { Db } from '#src/server/db/client.ts';
import type { PlanHorizon, PlanItemStatus } from '#src/server/db/types.ts';
import type { IsoDate } from '#src/server/domain/calendar.ts';
import type { NamedRef } from './entries.ts';

export type PlanScope = { readonly horizon: PlanHorizon; readonly from: IsoDate; readonly to: IsoDate };

export type ReportPlanItemRow = {
  readonly id: string;
  readonly title: string;
  readonly status: PlanItemStatus;
  readonly dueDate: IsoDate;
  readonly completedOn: IsoDate | null;
  readonly horizon: PlanHorizon;
  readonly assignees: readonly NamedRef[];
};

export type ReportMoveRow = { readonly title: string; readonly fromDue: IsoDate; readonly toDue: IsoDate };

export type ReportIssueRow = {
  readonly id: string;
  readonly title: string;
  readonly deadline: IsoDate;
  readonly resolvedOn: IsoDate | null;
  readonly assignees: readonly NamedRef[];
};

type ItemQuery =
  | { readonly kind: 'in_plans'; readonly scopes: readonly PlanScope[] }
  | { readonly kind: 'open_overdue'; readonly dueBefore: IsoDate; readonly asOf: IsoDate }
  | { readonly kind: 'completed'; readonly from: IsoDate; readonly to: IsoDate; readonly horizons: readonly PlanHorizon[] };

/** Plan items for a report, with assignees, in ONE query. */
export async function selectReportPlanItems(db: Db, projectId: string, query: ItemQuery): Promise<readonly ReportPlanItemRow[]> {
  return await db
    .selectFrom('planItems as pi')
    .innerJoin('plans as p', 'p.id', 'pi.planId')
    .select(['pi.id', 'pi.title', 'pi.status', 'pi.dueDate', 'pi.completedOn', 'p.horizon'])
    .select((eb) =>
      jsonArrayFrom(
        eb
          .selectFrom('planItemAssignees as pa')
          .innerJoin('people as pe', 'pe.id', 'pa.personId')
          .select(['pe.id', 'pe.name'])
          .whereRef('pa.planItemId', '=', 'pi.id')
          .orderBy('pe.name'),
      ).as('assignees'),
    )
    .where((eb) => {
      const project = eb('pi.projectId', '=', projectId);
      switch (query.kind) {
        case 'in_plans':
          return eb.and([
            project,
            eb.or(
              query.scopes.map((scope) =>
                eb.and([eb('p.horizon', '=', scope.horizon), eb('p.periodStart', '>=', scope.from), eb('p.periodStart', '<=', scope.to)]),
              ),
            ),
          ]);
        case 'open_overdue':
          // Unfinished as of `asOf` (done later, or not at all) and past the overdue cutoff.
          // `status <> 'done'` equals `completed_on IS NULL` (CHECK constraint) and matches the
          // partial index; the other branch uses plan_items_completed_idx.
          return eb.and([
            project,
            eb('pi.dueDate', '<', query.dueBefore),
            eb.or([eb('pi.status', '<>', 'done'), eb('pi.completedOn', '>', query.asOf)]),
          ]);
        case 'completed':
          return eb.and([
            project,
            eb('pi.completedOn', '>=', query.from),
            eb('pi.completedOn', '<=', query.to),
            eb('p.horizon', 'in', query.horizons),
          ]);
        default:
          return query satisfies never;
      }
    })
    .orderBy('pi.dueDate')
    .orderBy('pi.position')
    .orderBy('pi.createdAt')
    .execute();
}

/** BR-15 history: every move out of the plans in scope. */
export async function selectReportMoves(db: Db, projectId: string, scopes: readonly PlanScope[]): Promise<readonly ReportMoveRow[]> {
  return await db
    .selectFrom('planItemMoves as m')
    .innerJoin('plans as p', 'p.id', 'm.fromPlanId')
    .innerJoin('planItems as pi', 'pi.id', 'm.planItemId')
    .select(['pi.title', 'm.fromDue', 'm.toDue'])
    .where('p.projectId', '=', projectId)
    .where((eb) =>
      eb.or(
        scopes.map((scope) =>
          eb.and([eb('p.horizon', '=', scope.horizon), eb('p.periodStart', '>=', scope.from), eb('p.periodStart', '<=', scope.to)]),
        ),
      ),
    )
    .orderBy('m.fromDue')
    .orderBy('m.movedAt')
    .execute();
}

/**
 * Issues a report can mention, in ONE query: resolved within the range, or still open at
 * `asOf` with a deadline before the overdue cutoff.
 */
export async function selectReportIssues(
  db: Db,
  projectId: string,
  range: { readonly from: IsoDate; readonly to: IsoDate },
  overdue: { readonly deadlineBefore: IsoDate; readonly asOf: IsoDate },
): Promise<readonly ReportIssueRow[]> {
  return await db
    .selectFrom('issues as i')
    .select(['i.id', 'i.title', 'i.deadline', 'i.resolvedOn'])
    .select((eb) =>
      jsonArrayFrom(
        eb
          .selectFrom('issueAssignees as ia')
          .innerJoin('people as p', 'p.id', 'ia.personId')
          .select(['p.id', 'p.name'])
          .whereRef('ia.issueId', '=', 'i.id')
          .orderBy('p.name'),
      ).as('assignees'),
    )
    .where('i.projectId', '=', projectId)
    .where((eb) =>
      eb.or([
        eb.and([eb('i.resolvedOn', '>=', range.from), eb('i.resolvedOn', '<=', range.to)]),
        // `status <> 'resolved'` equals `resolved_on IS NULL` (CHECK constraint) and matches
        // the partial index issues_open_deadline_idx.
        eb.and([eb('i.status', '<>', 'resolved'), eb('i.deadline', '<', overdue.deadlineBefore)]),
        eb.and([eb('i.resolvedOn', '>', overdue.asOf), eb('i.deadline', '<', overdue.deadlineBefore)]),
      ]),
    )
    .orderBy('i.deadline')
    .orderBy('i.createdAt')
    .execute();
}
