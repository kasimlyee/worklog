'use server';

import { redirect } from 'next/navigation';
import { appDatabase } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { createRelease, deleteRelease, updateRelease } from '#src/server/services/releases.ts';
import type { FormState } from '#src/ui/view-models/forms.ts';
import { field, formObject, projectExists, projectGone, revalidateProject, toFormState } from './support.ts';

export async function createReleaseAction(projectId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  if (!(await projectExists(projectId))) {
    return projectGone;
  }
  const result = await createRelease(appDatabase(), projectId, formObject(formData, ['pullRequestIds']));
  if (!result.ok) {
    return toFormState(result, formData, null);
  }
  revalidateProject(projectId);
  redirect(`/projects/${projectId}/releases/${result.value.id}`);
}

export async function updateReleaseAction(projectId: string, releaseId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const result = await updateRelease(appDatabase(), projectId, releaseId, formObject(formData, ['pullRequestIds']));
  if (result.ok) {
    revalidateProject(projectId);
  }
  return toFormState(result, formData, 'Release saved.');
}

/** BR-36 */
export async function deleteReleaseAction(projectId: string, formData: FormData): Promise<void> {
  await requireSession();
  await deleteRelease(appDatabase(), projectId, field(formData, 'releaseId'));
  revalidateProject(projectId);
  redirect(`/projects/${projectId}/releases`);
}
