import { aPlan, aPlanItem } from '#tests/fixtures/builders.ts';
import { addDays, appToday, nextWorkingDay, previousWorkingDay } from './support/dates.ts';
import { e2eDb, expect, test } from './support/fixtures.ts';
import { seedProject } from './support/seed.ts';

/* Journey 5: an overdue item is red on the dashboard and switcher; moving it clears the red. */

test('BR-15: carry over an overdue item', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  const due = previousWorkingDay(appToday());
  const plan = await aPlan(e2eDb(), projectId, { horizon: 'day', periodStart: due });
  const item = await aPlanItem(e2eDb(), plan, { title: 'Write the migration', dueDate: due });

  await page.goto('/projects');
  await expect(page.getByText('1 overdue')).toBeVisible();

  await page.getByRole('link', { name: 'Atlas' }).click();
  const urgent = page.getByRole('region', { name: 'Urgent' });
  await expect(urgent.getByRole('link', { name: 'Write the migration' })).toBeVisible();
  await expect(urgent.locator('[data-tone="danger"]')).toContainText('overdue');

  await urgent.getByRole('link', { name: 'Write the migration' }).click();
  await expect(page).toHaveURL(new RegExp(`/plans/items/${item.id}$`));
  const target = nextWorkingDay(addDays(appToday(), 1));
  await page.getByLabel('New due date').fill(target);
  await page.getByRole('button', { name: 'Move item' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Item moved.' })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Moved from .+ to .+/)).toBeVisible();

  await page.getByRole('navigation', { name: 'Project' }).getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByRole('region', { name: 'Urgent' }).getByText('Nothing overdue.')).toBeVisible();
  await page.goto('/projects');
  await expect(page.getByText('Nothing overdue')).toBeVisible();
});
