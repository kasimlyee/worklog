import { readFile } from 'node:fs/promises';
import { aPlan, aPlanItem } from '#tests/fixtures/builders.ts';
import { appToday, weekStart } from './support/dates.ts';
import { e2eDb, expect, test } from './support/fixtures.ts';
import { seedProject } from './support/seed.ts';

/* BR-47: the week and the month plan download as Markdown and PDF from the Plans screen. */

test('BR-47: export the week plan and the month plan', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  const monday = weekStart(appToday());
  await aPlanItem(e2eDb(), await aPlan(e2eDb(), projectId, { horizon: 'week', periodStart: monday }), { title: 'Continuous broker acquisition', dueDate: monday });

  await page.goto(`/projects/${projectId}/plans?horizon=week&date=${monday}`);
  await page.getByText('Export plan').click();

  const markdown = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Markdown of the week plan' }).click();
  const weekFile = await markdown;
  expect(weekFile.suggestedFilename()).toBe(`atlas_plan_weekly_${monday}.md`);
  const text = await readFile(await weekFile.path(), 'utf8');
  expect(text).toMatch(/^# Atlas — Week \d+ plan$/m);
  expect(text).toContain('Continuous broker acquisition');

  const pdf = page.waitForEvent('download');
  await page.getByRole('link', { name: 'PDF of the month plan' }).click();
  const monthFile = await pdf;
  expect(monthFile.suggestedFilename()).toMatch(/^atlas_plan_monthly_\d{4}-\d{2}-01\.pdf$/);
  expect((await readFile(await monthFile.path())).subarray(0, 5).toString()).toBe('%PDF-');
});
