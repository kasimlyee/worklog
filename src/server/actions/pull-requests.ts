'use server';

import { redirect } from 'next/navigation';
import { appDatabase, appPullRequestDeps } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { addPullRequest, deletePullRequest, refreshPullRequest } from '#src/server/services/pull-requests.ts';
import type { FormState } from '#src/ui/view-models/forms.ts';
import { field, formObject, projectExists, projectGone, revalidateProject, toFormState } from './support.ts';

export async function addPullRequestAction(projectId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  if (!(await projectExists(projectId))) {
    return projectGone;
  }
  const result = await addPullRequest(appPullRequestDeps(), projectId, formObject(formData));
  if (result.ok) {
    revalidateProject(projectId);
  }
  return toFormState(result, formData, result.ok ? `Added #${String(result.value.number)} ${result.value.title}.` : null);
}

/**
 * BR-24. A one-click action cannot return a message, so a failure comes back as a
 * notice code in the URL; the page turns the code into text.
 */
export async function refreshPullRequestAction(projectId: string, formData: FormData): Promise<void> {
  await requireSession();
  const result = await refreshPullRequest(appPullRequestDeps(), projectId, field(formData, 'pullRequestId'));
  revalidateProject(projectId);
  if (!result.ok && result.error.code === 'conflict') {
    redirect(`/projects/${projectId}/pull-requests?notice=refresh-failed`);
  }
}

/** BR-36: refused while anything references the PR. */
export async function deletePullRequestAction(projectId: string, formData: FormData): Promise<void> {
  await requireSession();
  const result = await deletePullRequest(appDatabase(), projectId, field(formData, 'pullRequestId'));
  revalidateProject(projectId);
  if (!result.ok && result.error.code === 'conflict') {
    redirect(`/projects/${projectId}/pull-requests?notice=in-use`);
  }
}
