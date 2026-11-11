import 'server-only';
import { ok } from '#src/lib/result.ts';
import type { Db } from '#src/server/db/client.ts';
import type { IsoDate } from '#src/server/domain/calendar.ts';
import { planStartFor } from '#src/server/domain/plans.ts';
import { selectIssues, updateIssueStatus } from '#src/server/repositories/issues.ts';
import { getOrCreatePlan, insertPlanItem, selectPlanItemForIssue } from '#src/server/repositories/plans.ts';
import { invalid, notFound, type ServiceResult } from './errors.ts';
import { isUuid } from './fields.ts';

export type PlannedIssue = { readonly itemId: string; readonly wasAlreadyPlanned: boolean };

/**
 * BR-38: put an unresolved issue on today's day plan, so it gets worked on today.
 * Idempotent: an issue already on today's plan returns the existing item.
 */
export async function planIssueForToday(db: Db, projectId: string, issueId: string, today: IsoDate): Promise<ServiceResult<PlannedIssue>> {
  if (!isUuid(issueId)) {
    return notFound;
  }
  const dayStart = planStartFor('day', today);
  if (!dayStart.ok) {
    return invalid({ issueId: 'There is no day plan at the weekend.' });
  }
  return await db.transaction().execute(async (trx) => {
    const [issue] = await selectIssues(trx, projectId, { id: issueId });
    if (issue === undefined) {
      return notFound;
    }
    if (issue.status === 'resolved') {
      return invalid({ issueId: 'This issue is already resolved.' });
    }
    const plan = await getOrCreatePlan(trx, projectId, 'day', dayStart.value);
    const existing = await selectPlanItemForIssue(trx, plan.id, issue.id);
    if (existing !== undefined) {
      return ok({ itemId: existing.id, wasAlreadyPlanned: true });
    }
    const itemId = await insertPlanItem(
      trx,
      projectId,
      plan.id,
      { title: issue.title, areaId: issue.areaId, issueId: issue.id, dueDate: today },
      issue.assignees.map((person) => person.id),
    );
    if (issue.status === 'open') {
      await updateIssueStatus(trx, projectId, issue.id, { status: 'in_progress', resolvedOn: null, resolvedByPrId: null });
    }
    return ok({ itemId, wasAlreadyPlanned: false });
  });
}
