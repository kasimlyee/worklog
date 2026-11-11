'use server';

import { redirect } from 'next/navigation';
import { appDatabase, appToday } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import {
  createPlanItem, deletePlanItem, movePlanItem, setPlanItemStatus, updatePlanItem,
} from '#src/server/services/plans.ts';
import { planIssueForToday } from '#src/server/services/plan-issue.ts';
import type { FormState } from '#src/ui/view-models/forms.ts';
import { field, formObject, projectExists, projectGone, revalidateProject, toFormState } from './support.ts';

export async function createPlanItemAction(projectId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  if (!(await projectExists(projectId))) {
    return projectGone;
  }
  const result = await createPlanItem(appDatabase(), projectId, formObject(formData, ['personIds']));
  if (result.ok) {
    revalidateProject(projectId);
  }
  return toFormState(result, formData, 'Item added.');
}

export async function updatePlanItemAction(projectId: string, itemId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const result = await updatePlanItem(appDatabase(), projectId, itemId, formObject(formData, ['personIds']));
  if (result.ok) {
    revalidateProject(projectId);
  }
  return toFormState(result, formData, 'Item saved.');
}

/** BR-15 */
export async function movePlanItemAction(projectId: string, itemId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const result = await movePlanItem(appDatabase(), projectId, itemId, formObject(formData));
  if (result.ok) {
    revalidateProject(projectId);
  }
  return toFormState(result, formData, 'Item moved.');
}

/** BR-16 */
export async function setPlanItemStatusAction(projectId: string, formData: FormData): Promise<void> {
  await requireSession();
  await setPlanItemStatus(appDatabase(), projectId, field(formData, 'itemId'), formObject(formData), appToday());
  revalidateProject(projectId);
}

/** BR-36 */
export async function deletePlanItemAction(projectId: string, formData: FormData): Promise<void> {
  await requireSession();
  await deletePlanItem(appDatabase(), projectId, field(formData, 'itemId'));
  revalidateProject(projectId);
  redirect(`/projects/${projectId}/plans`);
}

/** BR-38: drag an issue onto today's plan, or press "Plan today". Idempotent. */
export async function planIssueTodayAction(projectId: string, formData: FormData): Promise<void> {
  await requireSession();
  await planIssueForToday(appDatabase(), projectId, field(formData, 'issueId'), appToday());
  revalidateProject(projectId);
}
