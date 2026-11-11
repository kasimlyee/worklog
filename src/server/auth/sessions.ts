import 'server-only';
import type { Db } from '#src/server/db/client.ts';
import {
  deleteExpiredSessions, deleteSession, findLiveSession, insertSession,
} from '#src/server/repositories/sessions.ts';
import { hashToken, randomToken, type RandomToken } from './tokens.ts';

export const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

export type Session = { readonly githubUserId: string; readonly expiresAt: Date };

/** Creates a session and returns the raw token for the cookie. Only its hash is stored. */
export async function createSession(
  db: Db,
  githubUserId: number,
  now: Date,
  random: RandomToken = randomToken,
): Promise<{ readonly token: string; readonly expiresAt: Date }> {
  const token = random();
  const expiresAt = new Date(now.getTime() + sessionLifetimeMs);
  await insertSession(db, { tokenHash: hashToken(token), githubUserId, createdAt: now, expiresAt });
  // docs/02 §7.6: cheap cleanup on sign-in instead of a cron job.
  await deleteExpiredSessions(db, now);
  return { token, expiresAt };
}

/**
 * The live session for a cookie token, or `null` for missing, unknown or expired tokens.
 * With `allowedUserId`, a session of any other GitHub user is also refused (allow-list changed).
 */
export async function findSession(
  db: Db,
  token: string | undefined,
  now: Date,
  allowedUserId?: number,
): Promise<Session | null> {
  if (token === undefined || token.length === 0 || token.length > 200) {
    return null;
  }
  const session = await findLiveSession(db, hashToken(token), now);
  if (session === undefined || (allowedUserId !== undefined && session.githubUserId !== String(allowedUserId))) {
    return null;
  }
  return session;
}

export async function endSession(db: Db, token: string | undefined): Promise<void> {
  if (token !== undefined && token.length > 0) {
    await deleteSession(db, hashToken(token));
  }
}
