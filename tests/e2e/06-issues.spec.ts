import type { Page } from '@playwright/test';
import { addDays, appToday, nextWorkingDay, previousWorkingDay } from './support/dates.ts';
import { expect, test } from './support/fixtures.ts';
import { seedProject } from './support/seed.ts';

/* Journey 6: due soon is yellow; resolving late is red "late", on time is green. */

async function createIssue(page: Page, projectId: string, title: string, assignedOn: string, deadline: string): Promise<void> {
  await page.goto(`/projects/${projectId}/issues/new`);
  const form = page.getByRole('form', { name: 'New issue' });
  await form.getByLabel('Short title').fill(title);
  await form.getByLabel('Link', { exact: true }).fill('https://jira.example.com/browse/APP-1');
  await form.getByLabel('Assigned').fill(assignedOn);
  await form.getByLabel('Deadline').fill(deadline);
  await form.getByLabel('Grace').check();
  await form.getByRole('button', { name: 'Create issue' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

test('BR-31: due soon is yellow, then resolving it on time is green', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  const today = appToday();

  await createIssue(page, projectId, 'Crash on save', today, nextWorkingDay(today));
  await expect(page.locator('[data-tone="warning"]').filter({ hasText: /Due/ })).toBeVisible();

  await page.getByRole('button', { name: 'Resolve issue' }).click();
  await expect(page.locator('[data-tone="success"]').filter({ hasText: 'Resolved on time' })).toBeVisible();
});

test('BR-31: resolving after the deadline is red and says how late', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  const today = appToday();
  const deadline = previousWorkingDay(previousWorkingDay(today));

  await createIssue(page, projectId, 'Slow export', addDays(deadline, -3), deadline);
  await expect(page.locator('[data-tone="danger"]').filter({ hasText: /overdue/ }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Resolve issue' }).click();
  await expect(page.locator('[data-tone="danger"]').filter({ hasText: /Resolved \d+ days? late/ })).toBeVisible();

  // BR-29: reopening clears the resolution.
  await page.getByRole('button', { name: 'Reopen issue' }).click();
  await expect(page.getByRole('button', { name: 'Resolve issue' })).toBeVisible();
});

test('BR-28: a deadline before the assigned date is refused', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  await page.goto(`/projects/${projectId}/issues/new`);
  const form = page.getByRole('form', { name: 'New issue' });
  await form.getByLabel('Short title').fill('Backwards');
  await form.getByLabel('Assigned').fill('2026-11-10');
  await form.getByLabel('Deadline').fill('2026-11-09');
  await form.getByLabel('Grace').check();
  await form.getByRole('button', { name: 'Create issue' }).click();

  await expect(form.getByRole('alert')).toContainText('The deadline must be on or after the assigned date.');
});
