import { describe, expect, it, vi } from 'vitest';
import { testDb } from '#tests/setup/test-db.ts';
import { completeSignIn, startSignIn, stateCookieName, type OAuthDeps } from './oauth.ts';
import { findSession } from './sessions.ts';

const config = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  appUrl: 'https://worklog.example.com',
  apiUrl: 'https://api.github.com',
  allowedUserId: 1234,
} as const;
const now = new Date('2026-11-10T08:00:00Z');

type FakeReply = { readonly status: number; readonly body: unknown } | 'network-error';

function fakeGitHub(token: FakeReply, user: FakeReply): typeof fetch {
  return vi.fn((input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : input.toString();
    const reply = url.endsWith('/access_token') ? token : user;
    if (reply === 'network-error') {
      return Promise.reject(new TypeError('fetch failed'));
    }
    return Promise.resolve(Response.json(reply.body, { status: reply.status }));
  });
}

const goodToken: FakeReply = { status: 200, body: { access_token: 'gho_secret' } };
const user = (id: number): FakeReply => ({ status: 200, body: { id, login: 'kasim' } });

function deps(fetchImpl: typeof fetch): OAuthDeps {
  return { db: testDb(), fetch: fetchImpl, now: () => now, random: () => 'session-token', config };
}

function callback(query: string, cookie?: string): Request {
  return new Request(`${config.appUrl}/auth/github/callback?${query}`, {
    headers: cookie === undefined ? {} : { cookie },
  });
}

const stateCookie = (state: string, next = '%2Fprojects'): string => `${stateCookieName}=${state}.${next}`;

describe('GET /auth/github', () => {
  it('redirects to GitHub with state and sets a 10-minute __Host- state cookie', () => {
    const response = startSignIn(new Request(`${config.appUrl}/auth/github?next=/projects/x`), {
      config,
      random: () => 'state-123',
    });

    const location = new URL(response.headers.get('location') ?? '');
    expect(response.status).toBe(302);
    expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(Object.fromEntries(location.searchParams)).toEqual({
      client_id: 'client-id',
      redirect_uri: 'https://worklog.example.com/auth/github/callback',
      state: 'state-123',
      allow_signup: 'false',
    });
    expect(response.headers.get('set-cookie')).toBe(
      '__Host-oauth_state=state-123.%2Fprojects%2Fx; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600',
    );
  });

  it('replaces an off-site next with /projects', () => {
    const response = startSignIn(new Request(`${config.appUrl}/auth/github?next=//evil.com`), { config, random: () => 's' });

    expect(response.headers.get('set-cookie')).toContain('s.%2Fprojects;');
  });
});

describe('GET /auth/github/callback', () => {
  it('creates a session, sets the session cookie and redirects to next on success', async () => {
    const response = await completeSignIn(
      callback('code=abc&state=s1', stateCookie('s1', '%2Fprojects%2Fp1')),
      deps(fakeGitHub(goodToken, user(1234))),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://worklog.example.com/projects/p1');
    const cookies = response.headers.getSetCookie();
    expect(cookies).toContain('__Host-oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
    expect(cookies).toContain('__Host-session=session-token; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000');
    await expect(findSession(testDb(), 'session-token', now)).resolves.toMatchObject({ githubUserId: '1234' });
  });

  it('never stores the GitHub access token', async () => {
    await completeSignIn(callback('code=abc&state=s1', stateCookie('s1')), deps(fakeGitHub(goodToken, user(1234))));

    const rows = await testDb().selectFrom('sessions').selectAll().execute();
    expect(JSON.stringify(rows)).not.toContain('gho_secret');
  });

  it.each([
    ['mismatched state', 'code=abc&state=other', stateCookie('s1')],
    ['missing state', 'code=abc', stateCookie('s1')],
    ['missing cookie', 'code=abc&state=s1', undefined],
    ['malformed cookie', 'code=abc&state=s1', `${stateCookieName}=s1`],
  ])('returns 400 and no session for %s', async (_label, query, cookie) => {
    const fetchImpl = fakeGitHub(goodToken, user(1234));

    const response = await completeSignIn(callback(query, cookie), deps(fetchImpl));

    expect(response.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await testDb().selectFrom('sessions').selectAll().execute()).toEqual([]);
  });

  it('returns 400 when GitHub sends no code', async () => {
    const response = await completeSignIn(callback('state=s1&error=access_denied', stateCookie('s1')), deps(fakeGitHub(goodToken, user(1))));

    expect(response.status).toBe(400);
  });

  it('returns 403 and no session for any other GitHub user', async () => {
    const response = await completeSignIn(callback('code=abc&state=s1', stateCookie('s1')), deps(fakeGitHub(goodToken, user(999))));

    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie().some((c) => c.startsWith('__Host-session'))).toBe(false);
    expect(await testDb().selectFrom('sessions').selectAll().execute()).toEqual([]);
  });

  it.each([
    ['token endpoint error', fakeGitHub({ status: 200, body: { error: 'bad_verification_code' } }, user(1234))],
    ['token endpoint 500', fakeGitHub({ status: 500, body: {} }, user(1234))],
    ['user endpoint 401', fakeGitHub(goodToken, { status: 401, body: {} })],
    ['malformed user', fakeGitHub(goodToken, { status: 200, body: { id: 'x' } })],
    ['network failure', fakeGitHub('network-error', user(1234))],
  ])('returns 502 and no session on %s', async (_label, fetchImpl) => {
    const response = await completeSignIn(callback('code=abc&state=s1', stateCookie('s1')), deps(fetchImpl));

    expect(response.status).toBe(502);
    expect(await testDb().selectFrom('sessions').selectAll().execute()).toEqual([]);
  });

  it('falls back to /projects when the stored next is tampered with', async () => {
    const response = await completeSignIn(
      callback('code=abc&state=s1', stateCookie('s1', '%2F%2Fevil.com')),
      deps(fakeGitHub(goodToken, user(1234))),
    );

    expect(response.headers.get('location')).toBe('https://worklog.example.com/projects');
  });

  it('survives a malformed percent-encoding in the stored next', async () => {
    const response = await completeSignIn(
      callback('code=abc&state=s1', stateCookie('s1', '%E0%A4%A')),
      deps(fakeGitHub(goodToken, user(1234))),
    );

    expect(response.headers.get('location')).toBe('https://worklog.example.com/projects');
  });
});
