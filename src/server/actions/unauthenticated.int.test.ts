import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testDb } from '#tests/setup/test-db.ts';
import { aProject } from '#tests/fixtures/builders.ts';
import * as auth from './auth.ts';
import * as entries from './entries.ts';
import * as issues from './issues.ts';
import * as notes from './notes.ts';
import * as plans from './plans.ts';
import * as projects from './projects.ts';
import * as pullRequests from './pull-requests.ts';
import * as releases from './releases.ts';

/*
 * docs/04 Phase 3 exit: every Server Action rejects a missing, unknown or expired session
 * before touching anything. Actions are enumerated from their modules, so a new action is
 * covered automatically.
 */

class Redirect extends Error {
  readonly location: string;

  constructor(location: string) {
    super(`redirect ${location}`);
    this.location = location;
  }
}

const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: () => (cookieValue.current === undefined ? undefined : { value: cookieValue.current }), set: vi.fn() }),
}));
vi.mock('next/navigation', () => ({
  redirect: (location: string) => {
    throw new Redirect(location);
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('#src/server/db/app-db.ts', () => ({ appDb: () => testDb() }));

const modules = { auth, entries, issues, notes, plans, projects, pullRequests, releases };
const actions = Object.entries(modules).flatMap(([moduleName, module]) =>
  Object.entries(module)
    .filter((entry): entry is [string, (...args: unknown[]) => Promise<unknown>] => typeof entry[1] === 'function')
    .map(([name, action]) => ({ name: `${moduleName}.${name}`, action })),
);

const env = {
  APP_URL: 'https://worklog.example.com',
  APP_TIME_ZONE: 'Africa/Kampala',
  DATABASE_URL: 'postgres://unused/unused',
  GITHUB_OAUTH_CLIENT_ID: 'x',
  GITHUB_OAUTH_CLIENT_SECRET: 'x',
  ALLOWED_GITHUB_USER_ID: '42',
  GITHUB_PR_TOKEN: 'x',
  GITHUB_ALLOWED_ORGS: 'acme',
  REPORT_AUTHOR_NAME: 'K',
};

beforeEach(() => {
  for (const [name, value] of Object.entries(env)) {
    vi.stubEnv(name, value);
  }
});

async function attempt(action: (...args: unknown[]) => Promise<unknown>, projectId: string): Promise<unknown> {
  const formData = new FormData();
  formData.set('name', 'Injected');
  formData.set('title', 'Injected');
  try {
    // Every action's leading parameters are ids, then (state, formData) or (formData).
    await action(projectId, projectId, formData, formData);
    return null;
  } catch (error) {
    return error;
  }
}

describe('Server Actions without a valid session', () => {
  it('there are actions to check', () => {
    expect(actions.length).toBeGreaterThan(30);
  });

  it.each([
    ['missing', undefined],
    ['unknown', 'not-a-real-session-token'],
  ])('NF-05: every action redirects to sign-in with a %s session and changes nothing', async (_label, token) => {
    cookieValue.current = token;
    const project = await aProject(testDb(), { name: 'Original' });

    for (const { name, action } of actions) {
      const outcome = await attempt(action, project.id);
      expect(outcome instanceof Redirect ? outcome.location : outcome, name).toBe('/sign-in');
    }

    expect(await testDb().selectFrom('projects').select('name').execute()).toEqual([{ name: 'Original' }]);
    expect(await testDb().selectFrom('people').selectAll().execute()).toEqual([]);
  });

  it('NF-05: an expired session is refused too', async () => {
    const { createSession, sessionLifetimeMs } = await import('#src/server/auth/sessions.ts');
    const { token } = await createSession(testDb(), 42, new Date(Date.now() - sessionLifetimeMs - 1000));
    cookieValue.current = token;
    const project = await aProject(testDb());

    for (const { name, action } of actions) {
      const outcome = await attempt(action, project.id);
      expect(outcome instanceof Redirect ? outcome.location : outcome, name).toBe('/sign-in');
    }
  });
});
