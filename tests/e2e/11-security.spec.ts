import { createSessionToken, resetDatabase } from './support/database.ts';
import { expect, signIn, test } from './support/fixtures.ts';
import { seedEverything } from './support/rich-seed.ts';
import { fill, pageRoutes } from './support/routes.ts';

/* docs/04 §4.3: route inventory and XSS payloads in every text field. */

test('the route inventory finds every page', () => {
  expect(pageRoutes().length).toBeGreaterThanOrEqual(20);
});

for (const state of ['missing', 'unknown', 'expired'] as const) {
  test(`NF-05: every page rejects a ${state} session`, async ({ page }) => {
    await resetDatabase();
    const ids = await seedEverything();
    if (state !== 'missing') {
      await signIn(page, state === 'unknown' ? 'forged-token' : await createSessionToken({ expired: true }));
    }

    for (const route of pageRoutes().filter((r) => r !== '/sign-in')) {
      await page.goto(fill(route, ids));
      await expect(page, route).toHaveURL(/\/sign-in/);
    }
  });
}

// Fits the shortest text column (area names, 60 characters).
const payload = (field: string): string => `${field}<img src=x onerror=alert(1)><script>alert(2)</script>`;

test('XSS payloads in every text field are shown as text on every page', async ({ signedIn: page }) => {
  const ids = await seedEverything(payload);
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });

  for (const route of pageRoutes().filter((r) => r !== '/sign-in')) {
    await page.goto(fill(route, ids));
    await expect(page.getByRole('heading', { level: 1 }), route).toBeVisible();
    expect(await page.locator('img[src="x"]').count(), route).toBe(0);
  }
  await page.goto(`/projects/${ids.projectId}`);
  await expect(page.getByText(payload('Entry')).first()).toBeVisible();
  expect(dialogs).toEqual([]);
});

test('XSS payloads stay inert in the Markdown export', async ({ signedIn: page }) => {
  const ids = await seedEverything(payload);

  const response = await page.request.get(`/projects/${ids.projectId}/reports/export?kind=monthly&start=${new Date().toISOString().slice(0, 8)}01&format=md`);
  const markdown = await response.text();

  // Every < is escaped, so no Markdown renderer turns it into a tag.
  expect(markdown).not.toMatch(/(?<!\\)<(img|script)/);
  expect(markdown).toContain('\\<img src=x onerror=alert\\(1\\)\\>\\<script\\>alert\\(2\\)\\</script\\>');
});
