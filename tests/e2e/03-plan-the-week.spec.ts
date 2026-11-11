import { appToday, weekStart, workingDayThisWeek } from './support/dates.ts';
import { expect, test } from './support/fixtures.ts';
import { seedProject } from './support/seed.ts';

/* Journey 3: create week and day plan items with assignees. */

test('plan the week and the day', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  const monday = weekStart(appToday());
  const day = workingDayThisWeek();

  await page.goto(`/projects/${projectId}/plans?horizon=week&date=${monday}`);
  const add = page.getByRole('form', { name: 'Add plan item' });
  await add.getByLabel('Title').fill('Ship login');
  await add.getByLabel('Due date').fill(day);
  await add.getByLabel('Area').selectOption({ label: 'Frontend' });
  await add.getByLabel('Grace').check();
  await add.getByLabel('Ali').check();
  await add.getByRole('button', { name: 'Add item' }).click();

  const item = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Ship login' }) });
  await expect(item).toBeVisible();
  await expect(item).toContainText('Ali, Grace');
  await expect(item).toContainText('Planned');

  await page.goto(`/projects/${projectId}/plans?horizon=day&date=${day}`);
  await expect(page.getByRole('navigation', { name: 'Plan horizon' }).getByRole('link', { name: 'Day' })).toHaveAttribute('aria-current', 'page');
  const addDay = page.getByRole('form', { name: 'Add plan item' });
  await addDay.getByLabel('Title').fill('Review PRs');
  await addDay.getByLabel('Ali').check();
  await addDay.getByRole('button', { name: 'Add item' }).click();
  await expect(page.getByRole('link', { name: 'Review PRs' })).toBeVisible();

  // BR-16: mark it done.
  await page.getByLabel('Status of Review PRs').selectOption('done');
  await page.getByRole('listitem').filter({ hasText: 'Review PRs' }).getByRole('button', { name: 'Update' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Review PRs' }).locator('[data-tone="success"]')).toHaveText('Done');
});

test('BR-11: a due date outside the plan period is refused with a message', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  const monday = weekStart(appToday());

  await page.goto(`/projects/${projectId}/plans?horizon=week&date=${monday}`);
  const add = page.getByRole('form', { name: 'Add plan item' });
  await add.getByLabel('Title').fill('Too late');
  await add.getByLabel('Due date').fill('2020-01-01');
  await add.getByRole('button', { name: 'Add item' }).click();

  await expect(add.getByRole('alert')).toContainText('The due date must be within Week of');
  await expect(add.getByLabel('Title')).toHaveValue('Too late');
});
