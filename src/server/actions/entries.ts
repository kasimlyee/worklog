'use server';

import { redirect } from 'next/navigation';
import { appDatabase, appPullRequestDeps } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { createEntry, deleteEntry, updateEntry } from '#src/server/services/entries.ts';
import type { FormState } from '#src/ui/view-models/forms.ts';
import { field, formObject, projectExists, projectGone, revalidateProject, toFormState } from './support.ts';

export async function createEntryAction(projectId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  if (!(await projectExists(projectId))) {
    return projectGone;
  }
  const result = await createEntry(appPullRequestDeps(), projectId, formObject(formData, ['personIds']));
  if (result.ok) {
    revalidateProject(projectId);
  }
  return toFormState(result, formData, 'Work logged.');
}

export async function updateEntryAction(projectId: string, entryId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const result = await updateEntry(appPullRequestDeps(), projectId, entryId, formObject(formData, ['personIds']));
  if (!result.ok) {
    return toFormState(result, formData, null);
  }
  revalidateProject(projectId);
  redirect(`/projects/${projectId}/log`);
}

/** BR-36 */
export async function deleteEntryAction(projectId: string, formData: FormData): Promise<void> {
  await requireSession();
  await deleteEntry(appDatabase(), projectId, field(formData, 'entryId'));
  revalidateProject(projectId);
  redirect(`/projects/${projectId}/log`);
}
