'use server';

import { redirect } from 'next/navigation';
import { appDatabase, appToday } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { createIssue, deleteIssue, resolveIssue, setIssueStatus, updateIssue } from '#src/server/services/issues.ts';
import type { FormState } from '#src/ui/view-models/forms.ts';
import { field, formObject, projectExists, projectGone, revalidateProject, toFormState } from './support.ts';

export async function createIssueAction(projectId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  if (!(await projectExists(projectId))) {
    return projectGone;
  }
  const result = await createIssue(appDatabase(), projectId, formObject(formData, ['personIds']));
  if (!result.ok) {
    return toFormState(result, formData, null);
  }
  revalidateProject(projectId);
  redirect(`/projects/${projectId}/issues/${result.value.id}`);
}

export async function updateIssueAction(projectId: string, issueId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const result = await updateIssue(appDatabase(), projectId, issueId, formObject(formData, ['personIds']));
  if (result.ok) {
    revalidateProject(projectId);
  }
  return toFormState(result, formData, 'Issue saved.');
}

/** BR-29, BR-30 */
export async function resolveIssueAction(projectId: string, issueId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const result = await resolveIssue(appDatabase(), projectId, issueId, formObject(formData), appToday());
  if (result.ok) {
    revalidateProject(projectId);
  }
  return toFormState(result, formData, 'Issue resolved.');
}

/** Open / in progress; from resolved this reopens (BR-29). */
export async function setIssueStatusAction(projectId: string, formData: FormData): Promise<void> {
  await requireSession();
  await setIssueStatus(appDatabase(), projectId, field(formData, 'issueId'), formObject(formData));
  revalidateProject(projectId);
}

/** BR-36 */
export async function deleteIssueAction(projectId: string, formData: FormData): Promise<void> {
  await requireSession();
  await deleteIssue(appDatabase(), projectId, field(formData, 'issueId'));
  revalidateProject(projectId);
  redirect(`/projects/${projectId}/issues`);
}
