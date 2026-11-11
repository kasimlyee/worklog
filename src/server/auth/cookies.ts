import 'server-only';

type CookieOptions = { readonly maxAgeSeconds: number };

/** `__Host-` cookies must be Secure, Path=/ and have no Domain (docs/02 §7). */
export function serializeCookie(name: string, value: string, { maxAgeSeconds }: CookieOptions): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${String(maxAgeSeconds)}`;
}

export function clearCookie(name: string): string {
  return serializeCookie(name, '', { maxAgeSeconds: 0 });
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
