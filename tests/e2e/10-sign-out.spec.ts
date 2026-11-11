import { expect, test } from './support/fixtures.ts';
import { e2eDb } from './support/database.ts';
import { seedProject } from './support/seed.ts';

/* Journey 10: signing out deletes the session; going back shows no data. */

test('sign out removes the session server-side', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(await e2eDb().selectFrom('sessions').selectAll().execute()).toEqual([]);

  // Pages are no-store, so Back fetches again and is sent to sign-in instead of showing data.
  await page.goBack();
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toHaveCount(0);
});
