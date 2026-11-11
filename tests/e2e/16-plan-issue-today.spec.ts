import { anIssue } from '#tests/fixtures/builders.ts';
import { appToday, isWorkingDay } from './support/dates.ts';
import { e2eDb, expect, test } from './support/fixtures.ts';
import { seedProject } from './support/seed.ts';

/* BR-38: drag an issue onto Today's plan, or press "Plan today". */

test.skip(!isWorkingDay(appToday()), 'There is no day plan at the weekend.');

test('BR-38: drag an issue onto Today’s plan, and use the button for another', async ({ signedIn: page, isMobile }) => {
  const { projectId } = await seedProject();
  await anIssue(e2eDb(), projectId, { title: 'Crash on save', deadline: '2099-01-01' });
  await anIssue(e2eDb(), projectId, { title: 'Slow export', deadline: '2099-01-02' });
  await page.goto(`/projects/${projectId}`);
  const todaysPlan = page.getByRole('region', { name: 'Today’s plan' });
  const openIssues = page.getByRole('region', { name: 'Open issues' });

  if (!isMobile) {
    await openIssues.getByRole('row', { name: /Crash on save/ }).dragTo(todaysPlan.getByText(/Drag an open issue here/));
    await expect(todaysPlan.getByRole('link', { name: 'Crash on save' }).first()).toBeVisible();
    await expect(todaysPlan.getByRole('status')).toHaveText('Added Crash on save to today’s plan.');
  }

  await openIssues.getByRole('button', { name: 'Plan today: Slow export' }).click();
  await expect(todaysPlan.getByRole('link', { name: 'Slow export' }).first()).toBeVisible();

  // An open issue that is planned becomes in progress; pressing again adds nothing.
  await expect(openIssues.getByRole('row', { name: /Slow export/ }).getByText('In progress')).toBeVisible();
  await openIssues.getByRole('button', { name: 'Plan today: Slow export' }).click();
  await page.reload();
  // One plan item (its title link plus its issue link), not two.
  await expect(todaysPlan.getByRole('link', { name: 'Slow export' })).toHaveCount(2);
});

test('BR-39: marking the plan item done resolves the issue', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  const issue = await anIssue(e2eDb(), projectId, { title: 'Broken share links', deadline: '2099-01-01' });
  await page.goto(`/projects/${projectId}`);

  await page.getByRole('region', { name: 'Open issues' }).getByRole('button', { name: 'Plan today: Broken share links' }).click();
  const todaysPlan = page.getByRole('region', { name: 'Today’s plan' });
  await expect(todaysPlan.getByRole('link', { name: 'Broken share links' }).first()).toBeVisible();
  await todaysPlan.getByLabel('Status of Broken share links').selectOption('done');
  await expect(todaysPlan.locator('[data-tone="success"]').filter({ hasText: 'Done' })).toBeVisible();

  await page.goto(`/projects/${projectId}/issues/${issue.id}`);
  await expect(page.locator('[data-tone="success"]').filter({ hasText: 'Resolved' }).first()).toBeVisible();

  // BR-40: the issue shows how it was resolved, linking to the plan item.
  const history = page.getByRole('region', { name: 'How it was resolved' });
  await expect(history.getByText('On time', { exact: true })).toBeVisible();
  await history.getByRole('link', { name: 'Broken share links' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Broken share links' })).toBeVisible();
});
