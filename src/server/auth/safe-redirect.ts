import 'server-only';

/** docs/02 §11: after sign-in, only same-origin relative paths. Anything else → `/projects`. */
export function safeRedirectPath(candidate: string | null | undefined): string {
  if (
    candidate === null ||
    candidate === undefined ||
    candidate.length > 500 ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    /[\\\s\u0000-\u001f]/.test(candidate) ||
    candidate.startsWith('/auth/') ||
    candidate.startsWith('/sign-in')
  ) {
    return '/projects';
  }
  return candidate;
}
