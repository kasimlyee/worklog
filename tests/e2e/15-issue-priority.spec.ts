import { addDays, appToday } from './support/dates.ts';
import { expect, test } from './support/fixtures.ts';
import { seedProject } from './support/seed.ts';

/* BR-37: priority is chosen on the form and makes an issue urgent before its deadline. */

test('BR-37: an urgent issue appears under Urgent long before its deadline', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  await page.goto(`/projects/${projectId}/issues/new`);
  const form = page.getByRole('form', { name: 'New issue' });
  await form.getByLabel('Short title').fill('Payments failing for some users');
  await form.getByLabel('Priority').selectOption('urgent');
  await form.getByLabel('Assigned').fill(appToday());
  await form.getByLabel('Deadline').fill(addDays(appToday(), 30));
  await form.getByLabel('Grace').check();
  await form.getByRole('button', { name: 'Create issue' }).click();
  await expect(page.locator('[data-tone="danger"]').filter({ hasText: 'Urgent' })).toBeVisible();

  await page.getByRole('navigation', { name: 'Project' }).getByRole('link', { name: 'Dashboard' }).click();
  const urgent = page.getByRole('region', { name: 'Urgent' });
  await expect(urgent.getByRole('link', { name: 'Payments failing for some users' })).toBeVisible();

  await page.goto(`/projects/${projectId}/issues?priority=low`);
  await expect(page.getByText('No issues.').first()).toBeVisible();
});
