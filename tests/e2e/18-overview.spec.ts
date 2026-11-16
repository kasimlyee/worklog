import { aPerson, aPlan, aPlanItem, aProject, anIssue, withPeople } from '#tests/fixtures/builders.ts';
import { appToday, previousWorkingDay } from './support/dates.ts';
import { e2eDb, expect, test } from './support/fixtures.ts';

/* BR-42, BR-43: one screen for every project's urgent work; workload per person. */

test('BR-42: the overview shows overdue work from every project; BR-43: People shows workload', async ({ signedIn: page }) => {
  const db = e2eDb();
  const atlas = await aProject(db, { name: 'Atlas' });
  const borealis = await aProject(db, { name: 'Borealis' });
  const grace = await aPerson(db, { name: 'Grace' });
  const due = previousWorkingDay(appToday());
  const item = await aPlanItem(db, await aPlan(db, atlas.id, { horizon: 'day', periodStart: due }), { title: 'Atlas migration', dueDate: due });
  await withPeople(db, 'planItemAssignees', item.id, [grace.id]);
  await anIssue(db, borealis.id, { title: 'Borealis payments', priority: 'urgent', deadline: '2099-01-01' });

  await page.goto('/');

  await expect(page).toHaveURL(/\/projects$/);
  const attention = page.getByRole('region', { name: 'Needs attention' });
  await expect(attention.getByRole('link', { name: 'Atlas migration' })).toBeVisible();
  await expect(attention.getByRole('link', { name: 'Borealis payments' })).toBeVisible();
  await attention.getByRole('link', { name: 'Borealis payments' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Borealis payments' })).toBeVisible();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'People' }).click();
  const graceRow = page.getByRole('table', { name: /Assignments per person/ }).getByRole('row', { name: /Grace/ });
  await expect(graceRow).toContainText('Atlas');
  await expect(graceRow.locator('[data-tone="danger"]')).toHaveText('1');
});
