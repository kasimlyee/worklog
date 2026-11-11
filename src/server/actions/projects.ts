'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { appDatabase } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import {
  createArea, createPerson, createProject, renameArea, renamePerson, reorderAreas, setAreaArchived, setPersonArchived,
  setProjectArchived, updateProject,
} from '#src/server/services/projects.ts';
import type { FormState } from '#src/ui/view-models/forms.ts';
import { field, formObject, projectExists, projectGone, revalidateProject, toFormState } from './support.ts';

export async function createProjectAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const result = await createProject(appDatabase(), formObject(formData));
  if (!result.ok) {
    return toFormState(result, formData, null);
  }
  revalidatePath('/projects');
  redirect(`/projects/${result.value.id}/settings`);
}

export async function updateProjectAction(projectId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const result = await updateProject(appDatabase(), projectId, formObject(formData));
  if (result.ok) {
    revalidatePath('/projects');
    revalidateProject(projectId);
  }
  return toFormState(result, formData, 'Project saved.');
}

/** BR-06 */
export async function setProjectArchivedAction(projectId: string, formData: FormData): Promise<void> {
  await requireSession();
  const archived = field(formData, 'archived') === 'true';
  await setProjectArchived(appDatabase(), projectId, archived);
  revalidatePath('/projects');
  revalidateProject(projectId);
  if (archived) {
    redirect('/projects');
  }
}

export async function createAreaAction(projectId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  if (!(await projectExists(projectId))) {
    return projectGone;
  }
  const result = await createArea(appDatabase(), projectId, formObject(formData));
  if (result.ok) {
    revalidateProject(projectId);
  }
  return toFormState(result, formData, 'Area added.');
}

export async function renameAreaAction(projectId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const result = await renameArea(appDatabase(), projectId, field(formData, 'areaId'), formObject(formData));
  if (result.ok) {
    revalidateProject(projectId);
  }
  return toFormState(result, formData, 'Area renamed.');
}

/** BR-06 */
export async function setAreaArchivedAction(projectId: string, formData: FormData): Promise<void> {
  await requireSession();
  await setAreaArchived(appDatabase(), projectId, field(formData, 'areaId'), field(formData, 'archived') === 'true');
  revalidateProject(projectId);
}

/** BR-07 */
export async function reorderAreasAction(projectId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const result = await reorderAreas(appDatabase(), projectId, formObject(formData, ['areaIds']));
  if (result.ok) {
    revalidateProject(projectId);
  }
  return toFormState(result, formData, 'Order saved.');
}

export async function createPersonAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const result = await createPerson(appDatabase(), formObject(formData));
  if (result.ok) {
    revalidatePath('/', 'layout');
  }
  return toFormState(result, formData, 'Person added.');
}

export async function renamePersonAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const result = await renamePerson(appDatabase(), field(formData, 'personId'), formObject(formData));
  if (result.ok) {
    revalidatePath('/', 'layout');
  }
  return toFormState(result, formData, 'Renamed.');
}

/** BR-06 */
export async function setPersonArchivedAction(formData: FormData): Promise<void> {
  await requireSession();
  await setPersonArchived(appDatabase(), field(formData, 'personId'), field(formData, 'archived') === 'true');
  revalidatePath('/', 'layout');
}
