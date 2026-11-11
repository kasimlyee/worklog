import { expect, test } from './support/fixtures.ts';
import { seedProject } from './support/seed.ts';

/* Journey 4: quick-log three entries across two PRs by pasting links; PR titles appear. */

test('quick log three entries across two PRs', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  await page.goto(`/projects/${projectId}`);

  const entries = [
    { text: 'Wired the login form', pr: 'https://github.com/acme/app/pull/12' },
    { text: 'Styled the errors', pr: 'https://github.com/acme/app/pull/12' },
    { text: 'Fixed the API timeout', pr: 'https://github.com/acme/api/pull/7' },
  ];
  await page.getByText('Quick log').click();
  const form = page.getByRole('form', { name: 'Quick log' });
  // Opening the panel puts the cursor in the description.
  await expect(form.getByLabel('What was done')).toBeFocused();
  for (const entry of entries) {
    await page.keyboard.type(entry.text);
    await form.getByLabel('Pull request link').fill(entry.pr);
    await form.getByLabel('Grace').check();
    await form.getByLabel('What was done').press('Control+Enter');
    // A saved entry resets the form; then the cursor goes back to the description.
    await expect(form.getByLabel('What was done')).toHaveValue('');
    await expect(form.getByRole('status')).toHaveText('Work logged.');
    await form.getByLabel('What was done').focus();
  }

  await page.goto(`/projects/${projectId}/log`);
  await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible();
  // Titles come from the (fake) GitHub API: even PRs are merged, odd ones open.
  await expect(page.getByRole('link', { name: /#12 Fix rounding in invoice totals \(#12\)/ })).toHaveCount(2);
  await expect(page.getByRole('link', { name: /#7 Add sign-in page \(#7\)/ })).toHaveCount(1);
  for (const entry of entries) {
    await expect(page.getByText(entry.text)).toBeVisible();
  }

  // BR-25: two PR records, not three.
  await page.goto(`/projects/${projectId}/pull-requests`);
  await expect(page.getByRole('button', { name: /^Refresh #/ })).toHaveCount(2);
});

test('BR-26: a PR GitHub cannot find stops the entry and says why', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  await page.goto(`/projects/${projectId}/log`);

  const form = page.getByRole('form', { name: 'Log work' });
  await form.getByLabel('What was done').fill('Work on a missing PR');
  await form.getByLabel('Pull request link').fill('https://github.com/acme/app/pull/404');
  await form.getByLabel('Ali').check();
  await form.getByRole('button', { name: 'Log work' }).click();

  await expect(form.getByRole('alert')).toContainText('GitHub could not find this pull request');
  await expect(form.getByLabel('What was done')).toHaveValue('Work on a missing PR');
});

test('BR-22: a PR from another organisation is refused', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  await page.goto(`/projects/${projectId}/log`);

  const form = page.getByRole('form', { name: 'Log work' });
  await form.getByLabel('What was done').fill('x');
  await form.getByLabel('Pull request link').fill('https://github.com/evil/app/pull/1');
  await form.getByLabel('Ali').check();
  await form.getByRole('button', { name: 'Log work' }).click();

  await expect(form.getByRole('alert')).toContainText('Pull requests from “evil” are not allowed');
});
