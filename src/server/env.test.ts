import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.ts';

const valid = {
  APP_URL: 'https://worklog.example.com/',
  APP_TIME_ZONE: 'Africa/Kampala',
  DATABASE_URL: 'postgres://user:pass@db.example.com/worklog',
  GITHUB_OAUTH_CLIENT_ID: 'client-id',
  GITHUB_OAUTH_CLIENT_SECRET: 'client-secret',
  ALLOWED_GITHUB_USER_ID: '1234567',
  GITHUB_PR_TOKEN: 'github_pat_abc',
  GITHUB_ALLOWED_ORGS: 'Suds-Tech, other-org',
  REPORT_AUTHOR_NAME: 'Kasim',
} as const;

function errorsFor(overrides: Record<string, string | undefined>): readonly string[] {
  const result = parseEnv({ ...valid, ...overrides });
  return result.ok ? [] : result.error;
}

describe('parseEnv', () => {
  it('parses a complete configuration', () => {
    const result = parseEnv(valid);

    expect(result.ok && result.value).toMatchObject({
      APP_URL: 'https://worklog.example.com',
      ALLOWED_GITHUB_USER_ID: 1234567,
      GITHUB_ALLOWED_ORGS: ['suds-tech', 'other-org'],
      GITHUB_API_URL: 'https://api.github.com',
    });
  });

  it.each(Object.keys(valid))('reports a missing %s', (name) => {
    expect(errorsFor({ [name]: undefined }).join()).toContain(name);
  });

  it('BR-01: rejects a time zone that is not a real IANA zone', () => {
    expect(errorsFor({ APP_TIME_ZONE: 'Mars/Olympus' })).toEqual([
      'APP_TIME_ZONE: must be an IANA time zone, e.g. Africa/Kampala',
    ]);
  });

  it('requires https for APP_URL except on localhost', () => {
    expect(errorsFor({ APP_URL: 'http://worklog.example.com' })).toEqual(['APP_URL: must be https:// (plain http is only allowed for localhost)']);
    expect(errorsFor({ APP_URL: 'http://localhost:3000' })).toEqual([]);
    expect(errorsFor({ APP_URL: 'http://127.0.0.1:3000' })).toEqual([]);
  });

  it('rejects a GitHub login in place of the numeric user id', () => {
    expect(errorsFor({ ALLOWED_GITHUB_USER_ID: 'kasim' })[0]).toContain('ALLOWED_GITHUB_USER_ID');
  });

  it('rejects a database URL that is not Postgres', () => {
    expect(errorsFor({ DATABASE_URL: 'mysql://x/y' })[0]).toContain('DATABASE_URL');
  });

  it('accepts a local http GitHub API URL for the E2E fake only', () => {
    expect(errorsFor({ GITHUB_API_URL: 'http://localhost:3200' })).toEqual([]);
    expect(errorsFor({ GITHUB_API_URL: 'http://evil.example.com' })[0]).toContain('GITHUB_API_URL');
    expect(errorsFor({ GITHUB_API_URL: 'http://localhost.evil.com:80' })[0]).toContain('GITHUB_API_URL');
  });

  it('never includes secret values in its messages', () => {
    const messages = errorsFor({ GITHUB_OAUTH_CLIENT_SECRET: '', DATABASE_URL: 'not a url with s3cret' });

    expect(messages.join()).not.toContain('s3cret');
  });
});
