import { readFile } from 'node:fs/promises';
import { aPullRequest, anEntry, withPeople } from '#tests/fixtures/builders.ts';
import { appToday, weekStart } from './support/dates.ts';
import { e2eDb, expect, test } from './support/fixtures.ts';
import { seedProject } from './support/seed.ts';

/* Journey 9: daily, weekly and monthly previews; PDF and Markdown exports match the preview. */

test('R-02: preview and export every report kind', async ({ signedIn: page }) => {
  const { projectId, areas, people } = await seedProject();
  const today = appToday();
  const pr = await aPullRequest(e2eDb(), projectId, { repo: 'app', number: 12, title: 'Add login', state: 'merged' });
  const entry = await anEntry(e2eDb(), projectId, { workDate: today, description: 'Wired the login form', areaId: areas.frontend, pullRequestId: pr.id });
  await withPeople(e2eDb(), 'entryPeople', entry.id, [people.grace]);

  await page.goto(`/projects/${projectId}/reports?kind=daily&date=${today}`);
  const preview = page.getByRole('article', { name: 'Report preview' });
  await expect(preview.getByRole('heading', { level: 2 })).toHaveText('Atlas — Daily report');
  await expect(preview).toContainText('#12 Add login');
  await expect(preview).toContainText('Wired the login form');
  await expect(preview).toContainText('Prepared by Kasim Test');

  // R-04: a report note appears under the header.
  await page.getByLabel('Note shown under the header').fill('Quiet day.');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(preview).toContainText('Quiet day.');

  const [markdown] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Export Markdown' }).click()]);
  expect(markdown.suggestedFilename()).toBe(`atlas_daily_${today}.md`);
  const text = await readFile(await markdown.path(), 'utf8');
  for (const expected of ['# Atlas — Daily report', '> Quiet day.', '### Frontend', '\\#12 Add login **[Merged]**', 'Wired the login form — Grace']) {
    expect(text).toContain(expected);
  }

  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Export PDF' }).click()]);
  expect(pdf.suggestedFilename()).toBe(`atlas_daily_${today}.pdf`);
  expect((await readFile(await pdf.path())).subarray(0, 5).toString()).toBe('%PDF-');

  await page.getByRole('navigation', { name: 'Report type' }).getByRole('link', { name: 'Weekly' }).click();
  await expect(preview.getByRole('heading', { level: 2 })).toHaveText('Atlas — Weekly report');
  await expect(preview.getByText('Summary')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`kind=weekly&date=${today}`));
  const [weekly] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Export Markdown' }).click()]);
  expect(weekly.suggestedFilename()).toBe(`atlas_weekly_${weekStart(today)}.md`);

  await page.getByRole('navigation', { name: 'Report type' }).getByRole('link', { name: 'Monthly' }).click();
  await expect(preview.getByRole('heading', { level: 2 })).toHaveText('Atlas — Monthly report');
  await expect(preview).toContainText('Merged pull requests');
});

test('R-08: an empty period still previews and exports', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();

  await page.goto(`/projects/${projectId}/reports?kind=monthly&date=2020-01-15`);

  await expect(page.getByRole('article', { name: 'Report preview' })).toContainText('No work recorded for this period.');
  const response = await page.request.get(`/projects/${projectId}/reports/export?kind=monthly&start=2020-01-01&format=md`);
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(await response.text()).toContain('No work recorded for this period.');
});
