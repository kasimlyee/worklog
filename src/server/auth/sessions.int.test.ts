import { describe, expect, it } from 'vitest';
import { testDb } from '#tests/setup/test-db.ts';
import { createSession, endSession, findSession, sessionLifetimeMs } from './sessions.ts';
import { hashToken } from './tokens.ts';

const now = new Date('2026-11-10T08:00:00Z');
const later = (ms: number): Date => new Date(now.getTime() + ms);

describe('sessions', () => {
  it('stores only the SHA-256 hash of the token, never the token', async () => {
    const { token } = await createSession(testDb(), 42, now, () => 'fixed-token');

    const rows = await testDb().selectFrom('sessions').selectAll().execute();
    expect(token).toBe('fixed-token');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash.equals(hashToken('fixed-token'))).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('fixed-token');
  });

  it('finds a live session by token', async () => {
    const { token } = await createSession(testDb(), 42, now);

    await expect(findSession(testDb(), token, later(1000))).resolves.toEqual({
      githubUserId: '42',
      expiresAt: later(sessionLifetimeMs),
    });
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['unknown', 'not-a-real-token'],
    ['absurdly long', 'x'.repeat(5000)],
  ])('rejects a %s token', async (_label, token) => {
    await createSession(testDb(), 42, now);

    await expect(findSession(testDb(), token, now)).resolves.toBeNull();
  });

  it('rejects an expired token after 30 days', async () => {
    const { token } = await createSession(testDb(), 42, now);

    await expect(findSession(testDb(), token, later(sessionLifetimeMs))).resolves.toBeNull();
  });

  it('refuses a session whose user is no longer the allowed user', async () => {
    const { token } = await createSession(testDb(), 42, now);

    await expect(findSession(testDb(), token, now, 43)).resolves.toBeNull();
    await expect(findSession(testDb(), token, now, 42)).resolves.not.toBeNull();
  });

  it('ending a session deletes it server-side', async () => {
    const { token } = await createSession(testDb(), 42, now);

    await endSession(testDb(), token);
    await endSession(testDb(), undefined);

    await expect(findSession(testDb(), token, now)).resolves.toBeNull();
  });

  it('purges expired sessions when a new one is created', async () => {
    await createSession(testDb(), 42, now, () => 'old');

    await createSession(testDb(), 42, later(sessionLifetimeMs + 1), () => 'new');

    const rows = await testDb().selectFrom('sessions').select('tokenHash').execute();
    expect(rows.map((row) => row.tokenHash.equals(hashToken('new')))).toEqual([true]);
  });
});
