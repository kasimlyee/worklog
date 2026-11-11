import { test as base, expect, type Page } from '@playwright/test';
import { createSessionToken, e2eDb, resetDatabase } from './database.ts';

export const baseURL = 'http://localhost:3100';

/** Sets the session cookie as the OAuth callback would (plain name: E2E runs on http://localhost). */
export async function signIn(page: Page, token?: string): Promise<void> {
  await page.context().addCookies([
    {
      name: 'worklog_session',
      value: token ?? (await createSessionToken()),
      url: baseURL,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

/** Every journey starts from an empty database and a signed-in browser. */
export const test = base.extend<{ signedIn: Page }>({
  signedIn: async ({ page }, use) => {
    await resetDatabase();
    await signIn(page);
    await use(page);
  },
});

export { expect, e2eDb };
