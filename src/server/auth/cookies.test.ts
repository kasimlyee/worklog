import { describe, expect, it } from 'vitest';
import { clearCookie, readCookie } from './cookies.ts';

describe('cookies', () => {
  it('reads one cookie out of a header', () => {
    expect(readCookie('a=1; __Host-session=tok=en; b=2', '__Host-session')).toBe('tok=en');
  });

  it('returns undefined for a missing header or name', () => {
    expect(readCookie(null, 'a')).toBeUndefined();
    expect(readCookie('ab=1; =x; bad', 'a')).toBeUndefined();
  });

  it('clears with Max-Age=0', () => {
    expect(clearCookie('x')).toContain('Max-Age=0');
  });
});
