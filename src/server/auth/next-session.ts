import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { appDb } from '#src/server/db/app-db.ts';
import { env } from '#src/server/env.ts';
import { cookieName, usesSecureCookies } from './cookies.ts';
import { endSession, findSession, type Session } from './sessions.ts';

/*
 * The one adapter between Next.js and the session service (docs/02 §7).
 * Called first in every page, layout, Server Action and Route Handler.
 */

function secureCookies(): boolean {
  return usesSecureCookies(env().APP_URL);
}

async function currentToken(): Promise<string | undefined> {
  const store = await cookies();
  // Configuration is read only after the cookie store, which keeps pages dynamic.
  return store.get(cookieName('session', secureCookies()))?.value;
}

/** Memoised per request: a layout and its page check the session with one query. */
export const currentSession = cache(async (): Promise<Session | null> => {
  // Read the cookie first: it marks the page dynamic before any configuration is touched.
  const token = await currentToken();
  return await findSession(appDb(), token, new Date(), env().ALLOWED_GITHUB_USER_ID);
});

/** The session, or a redirect to /sign-in. Never trust proxy.ts for this. */
export async function requireSession(): Promise<Session> {
  const session = await currentSession();
  if (session === null) {
    redirect('/sign-in');
  }
  return session;
}

/** Deletes the session row and the cookie. */
export async function signOut(): Promise<void> {
  await endSession(appDb(), await currentToken());
  const secure = secureCookies();
  (await cookies()).set(cookieName('session', secure), '', {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 0,
  });
}
