import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures.ts';
import { seedEverything } from './support/rich-seed.ts';
import { fill, pageRoutes } from './support/routes.ts';
import { resetDatabase } from './support/database.ts';

/* docs/04 §4.4: zero WCAG 2.2 AA violations on every page, in its main states. */

const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function violations(page: Page): Promise<readonly string[]> {
  const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test('NF-07: every page with data has no WCAG 2.2 AA violations', async ({ signedIn: page }) => {
  // axe over every page takes longer than the 30-second default in slower browsers.
  test.setTimeout(120_000);
  const ids = await seedEverything();
  const found: string[] = [];
  for (const route of pageRoutes()) {
    await page.goto(fill(route, ids));
    found.push(...(await violations(page)).map((violation) => `${route} → ${violation}`));
  }
  expect(found).toEqual([]);
});

test('NF-07: a weekend day plan (empty state) has no violations', async ({ signedIn: page }) => {
  const ids = await seedEverything();
  await page.goto(`/projects/${ids.projectId}/plans?horizon=day&date=2020-01-04`);
  expect(await violations(page)).toEqual([]);
});

test('NF-07: the quick log with validation errors is accessible', async ({ signedIn: page, browserName }) => {
  const ids = await seedEverything();
  await page.goto(`/projects/${ids.projectId}`);
  await page.getByText('Quick log').click();
  const form = page.getByRole('form', { name: 'Quick log' });
  await form.getByRole('button', { name: 'Log work' }).click();
  await expect(form.getByRole('alert')).toBeVisible();
  await expect(form.getByRole('alert')).toBeFocused();
  // axe-core on this state crashes Playwright's Firefox build (reproduced in isolation:
  // without axe the page works). The state is still checked in Chromium and WebKit.
  if (browserName !== 'firefox') {
    expect(await violations(page)).toEqual([]);
  }
});

test('NF-07: the confirm dialog is accessible', async ({ signedIn: page }) => {
  const ids = await seedEverything();
  await page.goto(`/projects/${ids.projectId}/issues/${ids.issueId}`);
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('NF-07: no projects, and the sign-in page, are accessible', async ({ signedIn: page }) => {
  await resetDatabase();
  await page.goto('/projects');
  expect(await violations(page), 'no projects').toEqual([]);
  await page.context().clearCookies();
  await page.goto('/sign-in');
  expect(await violations(page), 'sign in').toEqual([]);
});

test('NF-07: dark mode has no violations', async ({ signedIn: page }) => {
  const ids = await seedEverything();
  await page.emulateMedia({ colorScheme: 'dark' });
  const found: string[] = [];
  for (const route of ['', '/plans', '/issues', '/reports']) {
    await page.goto(`/projects/${ids.projectId}${route}`);
    found.push(...(await violations(page)).map((violation) => `${route} → ${violation}`));
  }
  expect(found).toEqual([]);
});

test('NF-07: keyboard only — carry over an overdue item (journey 5)', async ({ signedIn: page }) => {
  const ids = await seedEverything();
  await page.goto(`/projects/${ids.projectId}`);

  const link = page.getByRole('region', { name: 'Urgent' }).getByRole('link', { name: 'Plan item' });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Plan item' })).toBeVisible();
  // Date entry differs per browser locale; the value is set without a pointer, then Enter submits.
  await page.getByLabel('New due date').fill('2099-01-02');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('form', { name: 'Move plan item' }).getByRole('status')).toHaveText('Item moved.');
});

test('NF-07: keyboard only — switch report type and download (journey 9)', async ({ signedIn: page }) => {
  const ids = await seedEverything();
  await page.goto(`/projects/${ids.projectId}/reports`);

  await page.getByRole('navigation', { name: 'Report type' }).getByRole('link', { name: 'Monthly' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('article', { name: 'Report preview' }).getByRole('heading', { level: 2 })).toContainText('Monthly report');
  await page.getByRole('link', { name: 'Export Markdown' }).focus();
  const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
  expect(download.suggestedFilename()).toMatch(/^atlas_monthly_\d{4}-\d{2}-01\.md$/);
});

test('NF-07: status stays readable with colours forced off', async ({ signedIn: page }) => {
  const ids = await seedEverything();
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto(`/projects/${ids.projectId}`);

  const tags = page.locator('[data-tone]');
  expect(await tags.count()).toBeGreaterThan(0);
  for (const tag of await tags.all()) {
    await expect(tag).not.toHaveText('');
    expect(await tag.evaluate((element) => getComputedStyle(element).borderStyle)).toBe('solid');
  }
});
