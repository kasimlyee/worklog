import { expect, test } from './support/fixtures.ts';
import { seedEverything } from './support/rich-seed.ts';
import { fill, pageRoutes } from './support/routes.ts';

/* NF-04 (server rendering, little client JS) and NF-08 (browsers and phones). */

// Measured 474,621 bytes (uncompressed, mostly the React/Next.js runtime) on 2026-11-11.
// ~15% headroom; raise only deliberately, with a reason (docs/04 §4.5).
const dashboardScriptBudgetBytes = 550_000;

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('NF-04: every page is server-rendered and readable with JavaScript off', async ({ signedIn: page }) => {
    const ids = await seedEverything();
    for (const route of pageRoutes().filter((r) => r !== '/sign-in')) {
      await page.goto(fill(route, ids));
      await expect(page.getByRole('heading', { level: 1 }), route).toBeVisible();
    }
  });

  test('NF-04: one-click actions work before hydration (plain form posts)', async ({ signedIn: page }) => {
    const ids = await seedEverything();
    await page.goto(`/projects/${ids.projectId}/issues/${ids.issueId}`);

    await page.getByRole('button', { name: 'Mark in progress' }).click();

    await expect(page.locator('[data-tone="warning"]').filter({ hasText: 'In progress' }).first()).toBeVisible();
  });
});

test('NF-04: the dashboard ships a bounded amount of JavaScript', async ({ signedIn: page }) => {
  const ids = await seedEverything();
  let scriptBytes = 0;
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script') {
      void response.body().then((body) => {
        scriptBytes += body.length;
      });
    }
  });

  await page.goto(`/projects/${ids.projectId}`, { waitUntil: 'networkidle' });

  expect(scriptBytes).toBeGreaterThan(0);
  expect(scriptBytes).toBeLessThan(dashboardScriptBudgetBytes);
});

test('NF-08: dashboard, quick log and reports fit the screen without sideways scrolling', async ({ signedIn: page }) => {
  const ids = await seedEverything();
  for (const path of ['', '/reports', '/log', '/plans']) {
    await page.goto(`/projects/${ids.projectId}${path}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test('NF-08: quick logging works in this browser and viewport', async ({ signedIn: page }) => {
  const ids = await seedEverything();
  await page.goto(`/projects/${ids.projectId}`);

  await page.getByText('Quick log').click();
  const form = page.getByRole('form', { name: 'Quick log' });
  await form.getByLabel('What was done').fill('Logged from this device');
  await form.getByRole('group', { name: 'People' }).getByRole('checkbox').first().check();
  await form.getByRole('button', { name: 'Log work' }).click();

  await expect(form.getByRole('status')).toHaveText('Work logged.');
});

test('NF-01: a click shows progress at once, even when the server is slow', async ({ signedIn: page }) => {
  const ids = await seedEverything();
  await page.goto(`/projects/${ids.projectId}`);
  // Simulate a slow network for the next page's data.
  await page.route('**/issues**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  await page.getByRole('navigation', { name: 'Project' }).getByRole('link', { name: 'Issues' }).click();

  await expect(page.getByRole('progressbar', { name: 'Loading page' })).toBeVisible({ timeout: 300 });
  await expect(page.getByRole('heading', { level: 1, name: 'Issues' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Loading page' })).toHaveCount(0);
});

test('NF-01: one-click actions say what they are doing while they run', async ({ signedIn: page }) => {
  const ids = await seedEverything();
  await page.goto(`/projects/${ids.projectId}/issues/${ids.issueId}`);
  await page.route('**/issues/**', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    await route.continue();
  });

  await page.getByRole('button', { name: 'Mark in progress' }).click();

  await expect(page.getByRole('button', { name: 'Saving…' })).toBeVisible({ timeout: 300 });
  await expect(page.getByRole('button', { name: 'Back to open' })).toBeVisible();
});
