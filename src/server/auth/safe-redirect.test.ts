import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safe-redirect.ts';

describe('safeRedirectPath', () => {
  it('keeps same-origin relative paths', () => {
    expect(safeRedirectPath('/projects/abc/issues?x=1')).toBe('/projects/abc/issues?x=1');
  });

  it.each([
    null, undefined, '', 'https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '/a b',
    '/\tevil', '/auth/github', '/sign-in', `/${'a'.repeat(600)}`,
  ])('replaces %j with /projects', (candidate) => {
    expect(safeRedirectPath(candidate)).toBe('/projects');
  });
});
