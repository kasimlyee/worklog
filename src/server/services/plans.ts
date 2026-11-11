import 'server-only';
import * as z from 'zod';
import { ok } from '#src/lib/result.ts';
import type { Db } from '#src/server/db/client.ts';
import type { PlanItemStatus } from '#src/server/db/types.ts';
import type { IsoDate } from '#src/server/domain/calendar.ts';
import { planItemDeadline, type Deadline, type DeadlineState } from '#src/server/domain/deadlines.ts';
import {
  horizons, isInPeriod, isValidPeriodStart, periodLabel, planPeriod, planStartFor, type Horizon, type Period,
} from '#src/server/domain/plans.ts';
import type { NamedRef } from '#src/server/repositories/entries.ts';
import {
  deletePlanItemRow, getOrCreatePlan, insertPlanItem, moveItem, selectItemPlan, selectPlan, selectPlanItems,
  updatePlanItemRow, updatePlanItemStatus, type MoveRow, type PlanItemRow,
} from '#src/server/repositories/plans.ts';
import { invalid, notFound, parseInput, type ServiceResult } from './errors.ts';
import { idList, isUuid, oneOf, optionalId, requiredDate, requiredText } from './fields.ts';
import { referenceErrors } from './references.ts';

export const planItemStatuses = ['planned', 'in_progress', 'done', 'blocked'] as const satisfies readonly PlanItemStatus[];

export type PlanItem = {
  readonly id: string;
  readonly horizon: Horizon;
  readonly title: string;
  readonly status: PlanItemStatus;
  readonly dueDate: IsoDate;
  readonly completedOn: IsoDate | null;
  readonly area: NamedRef | null;
  readonly issue: { readonly id: string; readonly title: string } | null;
  readonly assignees: readonly NamedRef[];
  readonly moves: readonly MoveRow[];
  /** BR-13/BR-14, computed for `today`; null when done. */
  readonly deadline: Deadline<DeadlineState> | null;
};

export type PlanView = {
  readonly horizon: Horizon;
  readonly period: Period;
  readonly label: string;
  readonly items: readonly PlanItem[];
};

export function toPlanItem(row: PlanItemRow, today: IsoDate): PlanItem {
  return {
    id: row.id,
    horizon: row.horizon,
    title: row.title,
    status: row.status,
    dueDate: row.dueDate,
    completedOn: row.completedOn,
    area: row.areaId !== null && row.areaName !== null ? { id: row.areaId, name: row.areaName } : null,
    issue: row.issueId !== null && row.issueTitle !== null ? { id: row.issueId, title: row.issueTitle } : null,
    assignees: row.assignees,
    moves: row.moves,
    deadline: planItemDeadline(row, today),
  };
}

/**
 * The plan of one horizon covering `date` (any date inside the period). An empty plan is
 * shown when none exists yet; it is only created when the first item is added.
 */
export async function getPlan(db: Db, projectId: string, horizon: Horizon, date: IsoDate, today: IsoDate): Promise<PlanView | null> {
  const start = planStartFor(horizon, date);
  if (!start.ok) {
    return null;
  }
  const plan = await selectPlan(db, projectId, horizon, start.value);
  const rows = plan === undefined ? [] : await selectPlanItems(db, projectId, { planIds: [plan.id] });
  return {
    horizon,
    period: planPeriod(horizon, start.value),
    label: periodLabel(horizon, start.value),
    items: rows.map((row) => toPlanItem(row, today)),
  };
}

export async function getPlanItem(db: Db, projectId: string, itemId: string, today: IsoDate): Promise<PlanItem | null> {
  if (!isUuid(itemId)) {
    return null;
  }
  const [row] = await selectPlanItems(db, projectId, { itemId });
  return row === undefined ? null : toPlanItem(row, today);
}

const detailsInput = {
  title: requiredText('Title', 300),
  areaId: optionalId,
  issueId: optionalId,
  personIds: idList('person'),
};

const createInput = z.object({
  ...detailsInput,
  horizon: oneOf(horizons, 'plan'),
  periodStart: requiredDate('Plan period'),
  dueDate: requiredDate('Due date'),
});

/** BR-10, BR-11, BR-12: adds an item, creating the plan for its period if needed (BR-09). */
export async function createPlanItem(db: Db, projectId: string, input: unknown): Promise<ServiceResult<{ readonly id: string }>> {
  const parsed = parseInput(createInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  const { horizon, periodStart, dueDate, personIds, ...values } = parsed.value;
  if (!isValidPeriodStart(horizon, periodStart)) {
    return invalid({ periodStart: 'That is not the start of a plan period.' });
  }
  const period = planPeriod(horizon, periodStart);
  if (!isInPeriod(period, dueDate)) {
    return invalid({ dueDate: `The due date must be within ${periodLabel(horizon, periodStart)}.` });
  }
  const errors = await referenceErrors(db, projectId, { areaId: values.areaId, issueId: values.issueId, personIds });
  if (Object.keys(errors).length > 0) {
    return invalid(errors);
  }
  const id = await db.transaction().execute(async (trx) => {
    const plan = await getOrCreatePlan(trx, projectId, horizon, periodStart);
    return await insertPlanItem(trx, projectId, plan.id, { ...values, dueDate }, personIds);
  });
  return ok({ id });
}

const updateInput = z.object(detailsInput);

/** Title, area, issue and assignees. The due date changes only by moving (BR-15). */
export async function updatePlanItem(db: Db, projectId: string, itemId: string, input: unknown): Promise<ServiceResult<{ readonly id: string }>> {
  if (!isUuid(itemId)) {
    return notFound;
  }
  const parsed = parseInput(updateInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  const { personIds, ...values } = parsed.value;
  const errors = await referenceErrors(db, projectId, { areaId: values.areaId, issueId: values.issueId, personIds });
  if (Object.keys(errors).length > 0) {
    return invalid(errors);
  }
  const updated = await db.transaction().execute(async (trx) => await updatePlanItemRow(trx, projectId, itemId, values, personIds));
  return updated ? ok({ id: itemId }) : notFound;
}

const statusInput = z.object({ status: oneOf(planItemStatuses, 'status') });

/** BR-16: `completed_on` is today when done, cleared when reopened. */
export async function setPlanItemStatus(
  db: Db,
  projectId: string,
  itemId: string,
  input: unknown,
  today: IsoDate,
): Promise<ServiceResult<{ readonly id: string }>> {
  if (!isUuid(itemId)) {
    return notFound;
  }
  const parsed = parseInput(statusInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  const { status } = parsed.value;
  const updated = await updatePlanItemStatus(db, projectId, itemId, status, status === 'done' ? today : null);
  return updated ? ok({ id: itemId }) : notFound;
}

const moveInput = z.object({ dueDate: requiredDate('New due date') });

/**
 * BR-15: carry-over is manual. Sets the new due date, moves the item into the plan of the
 * same horizon covering that date (creating it if missing) and records the move.
 */
export async function movePlanItem(db: Db, projectId: string, itemId: string, input: unknown): Promise<ServiceResult<{ readonly id: string }>> {
  if (!isUuid(itemId)) {
    return notFound;
  }
  const parsed = parseInput(moveInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  const toDue = parsed.value.dueDate;
  return await db.transaction().execute(async (trx) => {
    const current = await selectItemPlan(trx, projectId, itemId);
    if (current === undefined) {
      return notFound;
    }
    if (current.status === 'done') {
      return invalid({ dueDate: 'This item is done. Reopen it before moving it.' });
    }
    if (current.dueDate === toDue) {
      return invalid({ dueDate: 'Choose a different date.' });
    }
    const target = planStartFor(current.horizon, toDue);
    if (!target.ok) {
      return invalid({ dueDate: 'Day and week plans cover working days only. Choose a Monday to Friday.' });
    }
    const toPlan = await getOrCreatePlan(trx, projectId, current.horizon, target.value);
    await moveItem(trx, projectId, itemId, { fromPlanId: current.id, toPlanId: toPlan.id, fromDue: current.dueDate, toDue });
    return ok({ id: itemId });
  });
}

/** BR-36 */
export async function deletePlanItem(db: Db, projectId: string, itemId: string): Promise<ServiceResult<null>> {
  if (!isUuid(itemId)) {
    return notFound;
  }
  return (await deletePlanItemRow(db, projectId, itemId)) ? ok(null) : notFound;
}
