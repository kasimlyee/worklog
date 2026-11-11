import 'server-only';
import * as z from 'zod';
import type { Db } from '#src/server/db/client.ts';
import { log } from '#src/server/log.ts';
import { err, ok, type Result } from '#src/lib/result.ts';
import { clearCookie, readCookie, serializeCookie } from './cookies.ts';
import { safeRedirectPath } from './safe-redirect.ts';
import { createSession, sessionCookieName, sessionLifetimeMs } from './sessions.ts';
import { randomToken, tokensMatch, type RandomToken } from './tokens.ts';

export const stateCookieName = '__Host-oauth_state';
const stateLifetimeSeconds = 10 * 60;
const githubWeb = 'https://github.com';

export type OAuthConfig = {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly appUrl: string;
  readonly apiUrl: string;
  readonly allowedUserId: number;
};

export type OAuthDeps = {
  readonly db: Db;
  readonly fetch: typeof fetch;
  readonly now: () => Date;
  readonly random?: RandomToken;
  readonly config: OAuthConfig;
};

function redirectUri(config: OAuthConfig): string {
  return `${config.appUrl}/auth/github/callback`;
}

function redirect(location: string, cookies: readonly string[] = []): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const cookie of cookies) {
    headers.append('Set-Cookie', cookie);
  }
  return new Response(null, { status: 302, headers });
}

function page(status: number, title: string, message: string, cookies: readonly string[] = []): Response {
  const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  for (const cookie of cookies) {
    headers.append('Set-Cookie', cookie);
  }
  // Constant strings only: nothing from the request is echoed back.
  const body = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${title}</title><body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1>${title}</h1><p>${message}</p><p><a href="/sign-in">Back to sign in</a></p></body></html>`;
  return new Response(body, { status, headers });
}

/** GET /auth/github — step 1 of docs/02 §7. */
export function startSignIn(request: Request, deps: Pick<OAuthDeps, 'random' | 'config'>): Response {
  const state = (deps.random ?? randomToken)();
  const next = safeRedirectPath(new URL(request.url).searchParams.get('next'));
  const authorize = new URL(`${githubWeb}/login/oauth/authorize`);
  authorize.searchParams.set('client_id', deps.config.clientId);
  authorize.searchParams.set('redirect_uri', redirectUri(deps.config));
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('allow_signup', 'false');
  const cookie = serializeCookie(stateCookieName, `${state}.${encodeURIComponent(next)}`, {
    maxAgeSeconds: stateLifetimeSeconds,
  });
  return redirect(authorize.toString(), [cookie]);
}

const tokenResponse = z.object({ access_token: z.string().min(1) });
const userResponse = z.object({ id: z.number().int().positive() });

type GitHubFailure = 'exchange_failed' | 'user_failed';

async function fetchGitHubUserId(code: string, deps: OAuthDeps): Promise<Result<number, GitHubFailure>> {
  const { config } = deps;
  try {
    const tokenRes = await deps.fetch(`${githubWeb}/login/oauth/access_token`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri(config),
      }),
      signal: AbortSignal.timeout(5000),
    });
    const token = tokenResponse.safeParse(tokenRes.ok ? await tokenRes.json() : null);
    if (!token.success) {
      return err('exchange_failed');
    }
    const userRes = await deps.fetch(`${config.apiUrl}/user`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token.data.access_token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(5000),
    });
    // The access token goes out of scope here: it is never stored (docs/02 §7.5).
    const user = userResponse.safeParse(userRes.ok ? await userRes.json() : null);
    return user.success ? ok(user.data.id) : err('user_failed');
  } catch {
    return err('exchange_failed');
  }
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** GET /auth/github/callback — steps 2–6 of docs/02 §7. */
export async function completeSignIn(request: Request, deps: OAuthDeps): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const state = params.get('state');
  const cookie = readCookie(request.headers.get('cookie'), stateCookieName) ?? '';
  const separator = cookie.indexOf('.');
  const expectedState = separator > 0 ? cookie.slice(0, separator) : '';
  const next = safeRedirectPath(separator > 0 ? safeDecode(cookie.slice(separator + 1)) : null);
  const clearState = clearCookie(stateCookieName);

  if (state === null || expectedState === '' || !tokensMatch(state, expectedState)) {
    log('warn', 'auth.state_mismatch');
    return page(400, 'Sign-in expired', 'The sign-in request could not be verified. Please try again.', [clearState]);
  }
  if (code === null || code.length === 0 || code.length > 200) {
    return page(400, 'Sign-in cancelled', 'GitHub did not complete the sign-in.', [clearState]);
  }

  const userId = await fetchGitHubUserId(code, deps);
  if (!userId.ok) {
    log('error', 'auth.github_failed', { code: userId.error });
    return page(502, 'GitHub unavailable', 'Could not confirm your GitHub account. Please try again.', [clearState]);
  }
  if (userId.value !== deps.config.allowedUserId) {
    log('warn', 'auth.user_not_allowed');
    return page(403, 'Not allowed', 'This GitHub account cannot use this app.', [clearState]);
  }

  const session = await createSession(deps.db, userId.value, deps.now(), deps.random);
  const sessionCookie = serializeCookie(sessionCookieName, session.token, { maxAgeSeconds: sessionLifetimeMs / 1000 });
  log('info', 'auth.signed_in');
  return redirect(new URL(next, deps.config.appUrl).toString(), [clearState, sessionCookie]);
}
