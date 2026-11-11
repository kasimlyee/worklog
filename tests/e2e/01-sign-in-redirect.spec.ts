import { createSessionToken, resetDatabase } from './support/database.ts';
import { expect, signIn, test } from './support/fixtures.ts';

/* Journey 1: an unauthenticated visit to any page lands on sign-in. */

test.beforeEach(async () => {
  await resetDatabase();
});

for (const path of ['/', '/projects', '/people', '/projects/00000000-0000-4000-8000-000000000000/issues']) {
  test(`NF-05: ${path} without a session redirects to sign-in`, async ({ page }) => {
    await page.goto(path);

    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toBeVisible();
  });
}

test('NF-05: an unknown session token is refused by the page itself, not just the proxy', async ({ page }) => {
  await signIn(page, 'forged-token');

  await page.goto('/projects');

  await expect(page).toHaveURL(/\/sign-in$/);
});

test('NF-05: an expired session is refused', async ({ page }) => {
  await signIn(page, await createSessionToken({ expired: true }));

  await page.goto('/projects');

  await expect(page).toHaveURL(/\/sign-in$/);
});

test('NF-05: a session of a user no longer allowed is refused', async ({ page }) => {
  await signIn(page, await createSessionToken({ userId: 1 }));

  await page.goto('/projects');

  await expect(page).toHaveURL(/\/sign-in$/);
});

test('the sign-in link carries the requested page through OAuth', async ({ page }) => {
  await page.goto('/people');

  const href = await page.getByRole('link', { name: 'Sign in with GitHub' }).getAttribute('href');
  expect(href).toBe('/auth/github?next=%2Fpeople');
});

test('a signed-in visit to sign-in goes to the projects', async ({ page }) => {
  await signIn(page);

  await page.goto('/sign-in');

  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
});
