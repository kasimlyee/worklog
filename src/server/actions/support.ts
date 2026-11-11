import 'server-only';
import { revalidatePath } from 'next/cache';
import { appDatabase } from '#src/server/app-context.ts';
import { errorMessage, type ServiceResult } from '#src/server/services/errors.ts';
import { getProject } from '#src/server/services/projects.ts';
import type { FormState, FormValues } from '#src/ui/view-models/forms.ts';

/*
 * Shared steps of every Server Action (docs/04 §3.1):
 * requireSession → FormData to a plain object → service → Result to form state → revalidate.
 */

const linkField = /^links\.(\d{1,2})\.(label|url)$/;

/**
 * FormData as a plain object for the service's zod schema. Fields named in `arrays`
 * always become arrays (checkbox groups); `links.N.label` / `links.N.url` become `links`.
 * Files are ignored: the app accepts no uploads.
 */
export function formObject(formData: FormData, arrays: readonly string[] = []): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lists = new Map<string, string[]>(arrays.map((name) => [name, []]));
  const links: { label?: string; url?: string }[] = [];
  for (const [name, value] of formData.entries()) {
    if (typeof value !== 'string' || name.startsWith('$ACTION')) {
      continue;
    }
    const link = linkField.exec(name);
    if (link !== null) {
      const index = Number(link[1]);
      const row = (links[index] ??= {});
      row[link[2] === 'url' ? 'url' : 'label'] = value;
      continue;
    }
    const list = lists.get(name);
    if (list === undefined) {
      result[name] = value;
    } else {
      list.push(value);
    }
  }
  for (const [name, list] of lists) {
    result[name] = list;
  }
  if (links.length > 0) {
    // Object.values skips the holes of a sparse array (missing row numbers).
    result['links'] = Object.values(links);
  }
  return result;
}

/** What was submitted, echoed back so fields keep their values after an error. */
export function echoValues(formData: FormData): FormValues {
  const values: Record<string, string | string[]> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value !== 'string' || name.startsWith('$ACTION')) {
      continue;
    }
    const existing = values[name];
    values[name] = existing === undefined ? value : [...(Array.isArray(existing) ? existing : [existing]), value];
  }
  return values;
}

export function toFormState(result: ServiceResult<unknown>, formData: FormData, successMessage: string | null): FormState {
  if (result.ok) {
    return { status: 'success', message: successMessage };
  }
  const error = result.error;
  return {
    status: 'error',
    message: errorMessage(error),
    fieldErrors: error.code === 'invalid' ? error.fieldErrors : {},
    values: echoValues(formData),
  };
}

export const projectGone: FormState = {
  status: 'error',
  message: 'This project no longer exists.',
  fieldErrors: {},
  values: {},
};

/** Any project id from the client is checked before use. */
export async function projectExists(projectId: string): Promise<boolean> {
  return (await getProject(appDatabase(), projectId)) !== null;
}

/** Every page of the project reads fresh data after a write. */
export function revalidateProject(projectId: string): void {
  revalidatePath(`/projects/${projectId}`, 'layout');
}

export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}
