import { aPlan, aPlanItem, anIssue } from '#tests/fixtures/builders.ts';
import { appToday } from './support/dates.ts';
import { e2eDb, expect, test } from './support/fixtures.ts';
import { seedProject } from './support/seed.ts';

/* BR-17, BR-44, BR-45: one log, several plan items and issues — every ticked one is saved and closed. */

test('BR-17: a log that finishes two plan items and fixes two issues closes all four', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  const today = appToday();
  const plan = await aPlan(e2eDb(), projectId, { horizon: 'month', periodStart: `${today.slice(0, 7)}-01` });
  const first = await aPlanItem(e2eDb(), plan, { title: 'Sales comments list view', dueDate: today });
  const second = await aPlanItem(e2eDb(), plan, { title: 'Hide the commission column', dueDate: today });
  const crash = await anIssue(e2eDb(), projectId, { title: 'Crash on save', deadline: '2099-01-01' });
  const typo = await anIssue(e2eDb(), projectId, { title: 'Typo on pricing', deadline: '2099-01-01' });

  await page.goto(`/projects/${projectId}`);
  await page.getByText('Quick log').click();
  const form = page.getByRole('form', { name: 'Quick log' });
  await form.getByLabel('What was done').fill('Admin dashboard batch');
  await form.getByLabel('Grace').check();
  for (const item of ['Sales comments list view', 'Hide the commission column']) {
    await form.getByRole('group', { name: 'Plan items' }).getByLabel(new RegExp(`^${item}`)).check();
    await form.getByLabel(new RegExp(`This finishes it — ${item}`)).check();
  }
  for (const title of ['Crash on save', 'Typo on pricing']) {
    await form.getByLabel(title, { exact: true }).check();
    await form.getByLabel(`Fix — ${title}`).fill(`Fixed ${title}`);
    await form.getByLabel(new RegExp(`This fixes it — ${title}`)).check();
  }
  await form.getByRole('button', { name: 'Log work' }).click();
  await expect(form.getByRole('status')).toHaveText('Work logged.');

  const items = await e2eDb().selectFrom('planItems').select(['id', 'status']).where('id', 'in', [first.id, second.id]).execute();
  expect(items.map((item) => item.status)).toEqual(['done', 'done']);
  const issues = await e2eDb().selectFrom('issues').select(['id', 'status']).where('id', 'in', [crash.id, typo.id]).execute();
  expect(issues.map((issue) => issue.status)).toEqual(['resolved', 'resolved']);
  const links = await e2eDb().selectFrom('entryIssues').select('issueId').execute();
  expect(links).toHaveLength(2);
});
