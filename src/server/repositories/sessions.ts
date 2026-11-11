import 'server-only';
import type { Db } from '#src/server/db/client.ts';

export type SessionRow = { readonly githubUserId: string; readonly expiresAt: Date };

export async function insertSession(
  db: Db,
  values: { readonly tokenHash: Buffer; readonly githubUserId: number; readonly createdAt: Date; readonly expiresAt: Date },
): Promise<void> {
  await db.insertInto('sessions').values(values).execute();
}

export async function findLiveSession(db: Db, tokenHash: Buffer, now: Date): Promise<SessionRow | undefined> {
  return await db
    .selectFrom('sessions')
    .select(['githubUserId', 'expiresAt'])
    .where('tokenHash', '=', tokenHash)
    .where('expiresAt', '>', now)
    .executeTakeFirst();
}

export async function deleteSession(db: Db, tokenHash: Buffer): Promise<void> {
  await db.deleteFrom('sessions').where('tokenHash', '=', tokenHash).execute();
}

export async function deleteExpiredSessions(db: Db, now: Date): Promise<number> {
  const result = await db.deleteFrom('sessions').where('expiresAt', '<=', now).executeTakeFirst();
  return Number(result.numDeletedRows);
}
