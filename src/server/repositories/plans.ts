import 'server-only';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import type { Db } from '#src/server/db/client.ts';
import type { PlanHorizon, PlanItemStatus } from '#src/server/db/types.ts';
import type { IsoDate } from '#src/server/domain/calendar.ts';
import type { NamedRef } from './entries.ts';

export type PlanRow = { readonly id: string; readonly horizon: PlanHorizon; readonly periodStart: IsoDate };

export type MoveRow = { readonly fromDue: IsoDate; readonly toDue: IsoDate; readonly movedAt: string };

export type PlanItemRow = {
  readonly id: string;
  readonly planId: string;
  readonly horizon: PlanHorizon;
  readonly periodStart: IsoDate;
  readonly title: string;
  readonly status: PlanItemStatus;
  readonly dueDate: IsoDate;
  readonly completedOn: IsoDate | null;
  readonly position: number;
  readonly areaId: string | null;
  readonly areaName: string | null;
  readonly issueId: string | null;
  readonly issueTitle: string | null;
  readonly assignees: readonly NamedRef[];
  readonly moves: readonly MoveRow[];
};

export type PlanItemFilter = {
  readonly planIds?: readonly string[];
  readonly itemId?: string;
  /** Unfinished items due on or before this date. */
  readonly openDueOnOrBefore?: IsoDate;
  /** Items of the plan with this horizon and period start. */
  readonly plan?: { readonly horizon: PlanHorizon; readonly periodStart: IsoDate };
  readonly openOnly?: boolean;
  readonly limit?: number;
};

/*
 * Writes below do not open transactions: services compose them inside one.
 */

/** Plan items with area, issue, assignees and move history in ONE query. */
export async function selectPlanItems(db: Db, projectId: string, filter: PlanItemFilter): Promise<readonly PlanItemRow[]> {
  if (filter.planIds?.length === 0) {
    return [];
  }
  return await db
    .selectFrom('planItems as pi')
    .innerJoin('plans as p', 'p.id', 'pi.planId')
    .leftJoin('areas as a', 'a.id', 'pi.areaId')
    .leftJoin('issues as i', 'i.id', 'pi.issueId')
    .select([
      'pi.id',
      'pi.planId',
      'p.horizon',
      'p.periodStart',
      'pi.title',
      'pi.status',
      'pi.dueDate',
      'pi.completedOn',
      'pi.position',
      'pi.areaId',
      'a.name as areaName',
      'pi.issueId',
      'i.title as issueTitle',
    ])
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom('planItemAssignees as pa')
          .innerJoin('people as pe', 'pe.id', 'pa.personId')
          .select(['pe.id', 'pe.name'])
          .whereRef('pa.planItemId', '=', 'pi.id')
          .orderBy('pe.name'),
      ).as('assignees'),
      jsonArrayFrom(
        eb
          .selectFrom('planItemMoves as m')
          // Inside JSON, a timestamptz is ISO 8601 text.
          .select(['m.fromDue', 'm.toDue', 'm.movedAt'])
          .whereRef('m.planItemId', '=', 'pi.id')
          .orderBy('m.movedAt'),
      ).as('moves'),
    ])
    .where((eb) => {
      const conditions = [eb('pi.projectId', '=', projectId)];
      if (filter.planIds !== undefined) {
        conditions.push(eb('pi.planId', 'in', filter.planIds));
      }
      if (filter.itemId !== undefined) {
        conditions.push(eb('pi.id', '=', filter.itemId));
      }
      if (filter.openDueOnOrBefore !== undefined) {
        conditions.push(eb('pi.status', '<>', 'done'), eb('pi.dueDate', '<=', filter.openDueOnOrBefore));
      }
      if (filter.plan !== undefined) {
        conditions.push(eb('p.horizon', '=', filter.plan.horizon), eb('p.periodStart', '=', filter.plan.periodStart));
      }
      if (filter.openOnly === true) {
        conditions.push(eb('pi.status', '<>', 'done'));
      }
      return eb.and(conditions);
    })
    .orderBy('pi.dueDate')
    .orderBy('pi.position')
    .orderBy('pi.createdAt')
    .$if(filter.limit !== undefined, (q) => q.limit(Number(filter.limit)))
    .execute();
}

export async function selectPlan(db: Db, projectId: string, horizon: PlanHorizon, periodStart: IsoDate): Promise<PlanRow | undefined> {
  return await db
    .selectFrom('plans')
    .select(['id', 'horizon', 'periodStart'])
    .where('projectId', '=', projectId)
    .where('horizon', '=', horizon)
    .where('periodStart', '=', periodStart)
    .executeTakeFirst();
}

/** BR-09: one plan per project, horizon and period — safe under concurrent creation. */
export async function getOrCreatePlan(db: Db, projectId: string, horizon: PlanHorizon, periodStart: IsoDate): Promise<PlanRow> {
  await db
    .insertInto('plans')
    .values({ projectId, horizon, periodStart })
    .onConflict((oc) => oc.columns(['projectId', 'horizon', 'periodStart']).doNothing())
    .execute();
  const plan = await selectPlan(db, projectId, horizon, periodStart);
  if (plan === undefined) {
    throw new Error('Plan vanished right after creation');
  }
  return plan;
}

export async function selectItemPlan(db: Db, projectId: string, itemId: string): Promise<(PlanRow & { status: PlanItemStatus; dueDate: IsoDate }) | undefined> {
  return await db
    .selectFrom('planItems as pi')
    .innerJoin('plans as p', 'p.id', 'pi.planId')
    .select(['p.id', 'p.horizon', 'p.periodStart', 'pi.status', 'pi.dueDate'])
    .where('pi.id', '=', itemId)
    .where('pi.projectId', '=', projectId)
    .executeTakeFirst();
}

export type PlanItemValues = {
  readonly title: string;
  readonly areaId: string | null;
  readonly issueId: string | null;
};

export async function insertPlanItem(
  db: Db,
  projectId: string,
  planId: string,
  values: PlanItemValues & { readonly dueDate: IsoDate },
  personIds: readonly string[],
): Promise<string> {
  const { id } = await db
    .insertInto('planItems')
    .values((eb) => ({
      projectId,
      planId,
      ...values,
      position: eb
        .selectFrom('planItems')
        .select(eb.fn.coalesce(eb(eb.fn.max('position'), '+', 1), eb.lit(0)).as('next'))
        .where('planId', '=', planId),
    }))
    .returning('id')
    .executeTakeFirstOrThrow();
  if (personIds.length > 0) {
    await db.insertInto('planItemAssignees').values(personIds.map((personId) => ({ planItemId: id, personId }))).execute();
  }
  return id;
}

export async function updatePlanItemRow(
  db: Db,
  projectId: string,
  itemId: string,
  values: PlanItemValues,
  personIds: readonly string[],
): Promise<boolean> {
  const result = await db
    .updateTable('planItems')
    .set({ ...values, updatedAt: new Date() })
    .where('id', '=', itemId)
    .where('projectId', '=', projectId)
    .executeTakeFirst();
  if (result.numUpdatedRows === 0n) {
    return false;
  }
  await db.deleteFrom('planItemAssignees').where('planItemId', '=', itemId).execute();
  if (personIds.length > 0) {
    await db.insertInto('planItemAssignees').values(personIds.map((personId) => ({ planItemId: itemId, personId }))).execute();
  }
  return true;
}

export async function updatePlanItemStatus(
  db: Db,
  projectId: string,
  itemId: string,
  status: PlanItemStatus,
  completedOn: IsoDate | null,
): Promise<boolean> {
  const result = await db
    .updateTable('planItems')
    .set({ status, completedOn, updatedAt: new Date() })
    .where('id', '=', itemId)
    .where('projectId', '=', projectId)
    .executeTakeFirst();
  return result.numUpdatedRows > 0n;
}

/** BR-15: new due date, new plan, and a history row. Call inside a transaction. */
export async function moveItem(
  db: Db,
  projectId: string,
  itemId: string,
  move: { readonly fromPlanId: string; readonly toPlanId: string; readonly fromDue: IsoDate; readonly toDue: IsoDate },
): Promise<void> {
  await db
    .updateTable('planItems')
    .set({ planId: move.toPlanId, dueDate: move.toDue, updatedAt: new Date() })
    .where('id', '=', itemId)
    .where('projectId', '=', projectId)
    .execute();
  await db.insertInto('planItemMoves').values({ planItemId: itemId, ...move }).execute();
}

export async function deletePlanItemRow(db: Db, projectId: string, itemId: string): Promise<boolean> {
  const result = await db.deleteFrom('planItems').where('id', '=', itemId).where('projectId', '=', projectId).executeTakeFirst();
  return result.numDeletedRows > 0n;
}
