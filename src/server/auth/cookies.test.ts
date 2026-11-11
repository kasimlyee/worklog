import { describe, expect, it } from 'vitest';
import { clearCookie, cookieName, readCookie, serializeCookie, usesSecureCookies } from './cookies.ts';

describe('cookies', () => {
  it('reads one cookie out of a header', () => {
    expect(readCookie('a=1; __Host-session=tok=en; b=2', '__Host-session')).toBe('tok=en');
  });

  it('returns undefined for a missing header or name', () => {
    expect(readCookie(null, 'a')).toBeUndefined();
    expect(readCookie('ab=1; =x; bad', 'a')).toBeUndefined();
  });

  it('clears with Max-Age=0', () => {
    expect(clearCookie('x', true)).toContain('Max-Age=0');
  });

  it('uses __Host- Secure cookies on https, and plain local names on http://localhost', () => {
    expect(usesSecureCookies('https://worklog.example.com')).toBe(true);
    expect(usesSecureCookies('http://localhost:3000')).toBe(false);
    expect(cookieName('session', true)).toBe('__Host-session');
    expect(cookieName('session', false)).toBe('worklog_session');
    expect(serializeCookie('a', 'b', { maxAgeSeconds: 1, secure: false })).toBe('a=b; Path=/; HttpOnly; SameSite=Lax; Max-Age=1');
  });
});
