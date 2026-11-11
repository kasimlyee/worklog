'use server';

import type { FormState } from '#src/ui/view-models/forms.ts';
import { isPreviewEnabled } from './enabled.ts';

/* Stand-in actions for the preview screens. Inert in production, where previews 404. */

function guard(): void {
  if (!isPreviewEnabled(process.env.NODE_ENV)) {
    throw new Error('Preview actions are disabled in production.');
  }
}

/** Always answers with a validation error, to preview error states. */
export async function previewFormAction(_previous: FormState, formData: FormData): Promise<FormState> {
  guard();
  const values: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value === 'string' && !name.startsWith('$ACTION')) {
      values[name] = value;
    }
  }
  return await Promise.resolve({
    status: 'error',
    message: 'Please correct the highlighted fields.',
    fieldErrors: Object.fromEntries(Object.keys(values).slice(0, 1).map((name) => [name, 'This is how a field error looks.'])),
    values,
  });
}

export async function previewPlainAction(): Promise<void> {
  guard();
  await Promise.resolve();
}
