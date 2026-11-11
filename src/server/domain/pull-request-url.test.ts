import { describe, expect, it } from 'vitest';
import { parsePullRequestUrl, pullRequestUrl } from './pull-request-url.ts';

const allowed = ['suds-tech'];

describe('parsePullRequestUrl', () => {
  it('BR-21: accepts the canonical PR URL', () => {
    expect(parsePullRequestUrl('https://github.com/suds-tech/web.app/pull/42', allowed)).toEqual({
      ok: true,
      value: { owner: 'suds-tech', repo: 'web.app', number: 42 },
    });
  });

  it('BR-21: trims surrounding whitespace from a paste', () => {
    expect(parsePullRequestUrl('  https://github.com/suds-tech/api/pull/7\n', allowed).ok).toBe(true);
  });

  it.each([
    'http://github.com/suds-tech/api/pull/7',
    'https://www.github.com/suds-tech/api/pull/7',
    'https://github.com.evil.com/suds-tech/api/pull/7',
    'https://user@github.com/suds-tech/api/pull/7',
    'https://github.com/suds-tech/api/pull/7/files',
    'https://github.com/suds-tech/api/pull/7#discussion',
    'https://github.com/suds-tech/api/pull/7?x=1',
    'https://github.com/suds-tech/api/issues/7',
    'https://github.com/suds-tech/api/pull/0',
    'https://github.com/suds-tech/api/pull/007',
    'https://github.com/suds-tech/api/pull/99999999999',
    'https://github.com/suds-tech/api/pull/2147483648',
    'https://github.com/-suds/api/pull/7',
    'https://github.com/suds-tech/../pull/7',
    'https://github.com/suds-tech/a b/pull/7',
    'suds-tech/api#7',
    '',
  ])('BR-21: rejects %j', (input) => {
    expect(parsePullRequestUrl(input, allowed)).toEqual({ ok: false, error: { code: 'invalid_format' } });
  });

  it('BR-22: rejects an owner outside the allow-list', () => {
    expect(parsePullRequestUrl('https://github.com/someone/api/pull/1', allowed)).toEqual({
      ok: false,
      error: { code: 'org_not_allowed', owner: 'someone' },
    });
  });

  it('BR-22: compares the owner case-insensitively', () => {
    expect(parsePullRequestUrl('https://github.com/Suds-Tech/api/pull/1', allowed).ok).toBe(true);
  });
});

describe('pullRequestUrl', () => {
  it('BR-21: rebuilds the canonical URL', () => {
    expect(pullRequestUrl({ owner: 'suds-tech', repo: 'api', number: 7 })).toBe('https://github.com/suds-tech/api/pull/7');
  });
});
