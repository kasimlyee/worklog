import { aPullRequest } from '#tests/fixtures/builders.ts';
import { appToday } from './support/dates.ts';
import { e2eDb, expect, test } from './support/fixtures.ts';
import { seedProject } from './support/seed.ts';

/* Journey 7: create a release, link PRs, mark it released. */

test('BR-32: create, link PRs and release', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  await aPullRequest(e2eDb(), projectId, { repo: 'app', number: 12, title: 'Add login', state: 'merged' });
  await aPullRequest(e2eDb(), projectId, { repo: 'app', number: 14, title: 'Error states', state: 'open' });

  await page.goto(`/projects/${projectId}/releases/new`);
  const create = page.getByRole('form', { name: 'New release' });
  await create.getByLabel('Version').fill('1.4.0');
  await create.getByLabel('Notes (Markdown)').fill('**Highlights**: sign-in with GitHub.');
  await create.getByLabel('app #12 Add login').check();
  await create.getByLabel('app #14 Error states').check();
  await create.getByRole('button', { name: 'Create release' }).click();

  await expect(page.getByRole('heading', { level: 1, name: '1.4.0' })).toBeVisible();
  await expect(page.locator('[data-tone="neutral"]').filter({ hasText: 'Planned' })).toBeVisible();
  const edit = page.getByRole('form', { name: 'Edit release' });
  await expect(page.getByRole('link', { name: /#12 Add login/ })).toBeVisible();
  await expect(page.getByLabel('Release notes').locator('strong')).toHaveText('Highlights');

  // A released version needs its date.
  await edit.getByLabel('Status').selectOption('released');
  await edit.getByRole('button', { name: 'Save release' }).click();
  await expect(edit.getByRole('alert')).toContainText('A released version needs its released date.');

  await edit.getByLabel('Released on').fill(appToday());
  await edit.getByRole('button', { name: 'Save release' }).click();
  await expect(edit.getByRole('status')).toHaveText('Release saved.');
  await page.reload();
  await expect(page.locator('[data-tone="success"]').filter({ hasText: 'Released' }).first()).toBeVisible();
});
