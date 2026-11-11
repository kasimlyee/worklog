import 'server-only';
import * as z from 'zod';
import { err, ok, type Result } from '#src/lib/result.ts';

export type FieldErrors = Readonly<Record<string, string>>;

/**
 * Every expected failure a user can cause (docs/02 §4.2). The messages here are the
 * user-facing text: components show them as they are.
 */
export type ServiceError =
  | { readonly code: 'invalid'; readonly fieldErrors: FieldErrors }
  | { readonly code: 'not_found' }
  | { readonly code: 'conflict'; readonly message: string };

export type ServiceResult<T> = Result<T, ServiceError>;

export function invalid(fieldErrors: FieldErrors): { readonly ok: false; readonly error: ServiceError } {
  return err({ code: 'invalid', fieldErrors });
}

export const notFound = { ok: false, error: { code: 'not_found' } } as const satisfies Result<never, ServiceError>;

export function conflict(message: string): { readonly ok: false; readonly error: ServiceError } {
  return err({ code: 'conflict', message });
}

/** Parses untrusted input. The first message per top-level field becomes that field's error. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): ServiceResult<z.infer<S>> {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return ok(parsed.data);
  }
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? 'form');
    fieldErrors[field] ??= issue.message;
  }
  return invalid(fieldErrors);
}

/** The text shown for an error that is not tied to one field. */
export function errorMessage(error: ServiceError): string {
  switch (error.code) {
    case 'invalid':
      return error.fieldErrors['form'] ?? 'Please correct the highlighted fields.';
    case 'not_found':
      return 'That item no longer exists. It may have been deleted.';
    case 'conflict':
      return error.message;
    default:
      return error satisfies never;
  }
}
