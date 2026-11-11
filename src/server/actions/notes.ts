'use server';

import { redirect } from 'next/navigation';
import { appDatabase } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { createNote, deleteNote, updateNote } from '#src/server/services/notes.ts';
import { saveReportNote } from '#src/server/services/report-notes.ts';
import type { FormState } from '#src/ui/view-models/forms.ts';
import { field, formObject, projectExists, projectGone, revalidateProject, toFormState } from './support.ts';

export async function createNoteAction(projectId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  if (!(await projectExists(projectId))) {
    return projectGone;
  }
  const result = await createNote(appDatabase(), projectId, formObject(formData));
  if (!result.ok) {
    return toFormState(result, formData, null);
  }
  revalidateProject(projectId);
  redirect(`/projects/${projectId}/notes/${result.value.id}`);
}

export async function updateNoteAction(projectId: string, noteId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const result = await updateNote(appDatabase(), projectId, noteId, formObject(formData));
  if (!result.ok) {
    return toFormState(result, formData, null);
  }
  revalidateProject(projectId);
  redirect(`/projects/${projectId}/notes/${noteId}`);
}

/** BR-36 */
export async function deleteNoteAction(projectId: string, formData: FormData): Promise<void> {
  await requireSession();
  await deleteNote(appDatabase(), projectId, field(formData, 'noteId'));
  revalidateProject(projectId);
  redirect(`/projects/${projectId}/notes`);
}

/** R-04 */
export async function saveReportNoteAction(projectId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  if (!(await projectExists(projectId))) {
    return projectGone;
  }
  const result = await saveReportNote(appDatabase(), projectId, formObject(formData));
  if (result.ok) {
    revalidateProject(projectId);
  }
  return toFormState(result, formData, 'Report note saved.');
}
