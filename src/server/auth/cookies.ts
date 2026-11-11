import 'server-only';

/**
 * Whether cookies are `__Host-` prefixed and Secure: always on https. Plain http is only
 * accepted for localhost (env.ts), where Safari refuses Secure cookies.
 */
export function usesSecureCookies(appUrl: string): boolean {
  return appUrl.startsWith('https://');
}

export type CookieBase = 'session' | 'oauth_state';

/** docs/02 §7: `__Host-session`, `__Host-oauth_state` (local http: `worklog_session`, …). */
export function cookieName(base: CookieBase, secure: boolean): string {
  return secure ? `__Host-${base}` : `worklog_${base}`;
}

type CookieOptions = { readonly maxAgeSeconds: number; readonly secure: boolean };

/** `__Host-` cookies must be Secure, Path=/ and have no Domain. */
export function serializeCookie(name: string, value: string, { maxAgeSeconds, secure }: CookieOptions): string {
  return `${name}=${value}; Path=/; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Lax; Max-Age=${String(maxAgeSeconds)}`;
}

export function clearCookie(name: string, secure: boolean): string {
  return serializeCookie(name, '', { maxAgeSeconds: 0, secure });
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (header === null) {
    return undefined;
  }
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator > 0 && pair.slice(0, separator).trim() === name) {
      return pair.slice(separator + 1).trim();
    }
  }
  return undefined;
}
