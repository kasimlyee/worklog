import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { appDb } from '#src/server/db/app-db.ts';
import { env } from '#src/server/env.ts';
import { endSession, findSession, sessionCookieName, type Session } from './sessions.ts';

/*
 * The one adapter between Next.js and the session service (docs/02 §7).
 * Called first in every page, layout, Server Action and Route Handler.
 */

async function currentToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieName)?.value;
}

export async function currentSession(): Promise<Session | null> {
  return await findSession(appDb(), await currentToken(), new Date(), env().ALLOWED_GITHUB_USER_ID);
}

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
  (await cookies()).set(sessionCookieName, '', {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 0,
  });
}
