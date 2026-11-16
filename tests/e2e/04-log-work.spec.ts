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
    await form.getByLabel('Pull request links').fill(entry.pr);
    await form.getByLabel('Grace').check();
    await form.getByLabel('What was done').press('Control+Enter');
    // A saved entry resets the form; then the cursor goes back to the description.
    await expect(form.getByLabel('What was done')).toHaveValue('');
    await expect(form.getByRole('status')).toHaveText('Work logged.');
    await form.getByLabel('What was done').focus();
  }

  await page.goto(`/projects/${projectId}/log`);
  // Option B: every entry in the list; the newest shown in full beside it.
  const list = page.getByRole('navigation', { name: 'Entries by day' });
  for (const entry of entries) {
    await expect(list.getByRole('link', { name: new RegExp(entry.text) })).toBeVisible();
  }
  // Titles come from the (fake) GitHub API: even PRs are merged, odd ones open.
  const detail = page.getByRole('article');
  await expect(detail.getByRole('heading', { level: 2 })).toHaveText('Fixed the API timeout');
  await expect(detail.getByRole('link', { name: /#7 Add sign-in page \(#7\)/ })).toBeVisible();

  // Picking another entry shows it, and the URL can be shared.
  await list.getByRole('link', { name: /Wired the login form/ }).click();
  await expect(page).toHaveURL(/entry=/);
  await expect(detail.getByRole('heading', { level: 2 })).toHaveText('Wired the login form');
  await expect(detail.getByRole('link', { name: /#12 Fix rounding in invoice totals \(#12\)/ })).toBeVisible();

  // Search finds work by PR title too.
  await page.getByLabel('Search').fill('sign-in page');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(list.getByRole('link')).toHaveCount(1);
  await expect(list.getByRole('link', { name: /Fixed the API timeout/ })).toBeVisible();

  // BR-25: two PR records, not three.
  await page.goto(`/projects/${projectId}/pull-requests`);
  await expect(page.getByRole('button', { name: /^Refresh from GitHub: #/ })).toHaveCount(2);
});

test('BR-26: a PR GitHub cannot find stops the entry and says why', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  await page.goto(`/projects/${projectId}/log`);
  await page.getByText('Quick log').click();

  const form = page.getByRole('form', { name: 'Quick log' });
  await form.getByLabel('What was done').fill('Work on a missing PR');
  await form.getByLabel('Pull request links').fill('https://github.com/acme/app/pull/404');
  await form.getByLabel('Ali').check();
  await form.getByRole('button', { name: 'Log work' }).click();

  await expect(form.getByRole('alert')).toContainText('GitHub could not find this pull request');
  await expect(form.getByLabel('What was done')).toHaveValue('Work on a missing PR');
});

test('BR-22: a PR from another organisation is refused', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  await page.goto(`/projects/${projectId}/log`);
  await page.getByText('Quick log').click();

  const form = page.getByRole('form', { name: 'Quick log' });
  await form.getByLabel('What was done').fill('x');
  await form.getByLabel('Pull request links').fill('https://github.com/evil/app/pull/1');
  await form.getByLabel('Ali').check();
  await form.getByRole('button', { name: 'Log work' }).click();

  await expect(form.getByRole('alert')).toContainText('Pull requests from “evil” are not allowed');
});
