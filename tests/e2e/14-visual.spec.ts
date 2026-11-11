import { existsSync } from 'node:fs';
import { aPlan, aPlanItem, aPullRequest, anEntry, withPeople } from '#tests/fixtures/builders.ts';
import { e2eDb, expect, test } from './support/fixtures.ts';
import { seedProject } from './support/seed.ts';

/*
 * docs/04 §4.6: screenshot comparisons in light and dark. The server's clock cannot be set
 * from the browser, so pages show a fixed past week with finished work, and the few
 * date-dependent texts are masked. Baselines are per platform; a platform without
 * committed baselines skips (generate them with `--update-snapshots` on that platform).
 */

test.skip(({ browserName }) => browserName !== 'chromium', 'Visual baselines are kept for Chromium only.');

const week = '2020-01-06';

async function seedFixedWeek(): Promise<string> {
  const { projectId, areas, people } = await seedProject();
  const db = e2eDb();
  const pr = await aPullRequest(db, projectId, { repo: 'app', number: 12, title: 'Add login', state: 'merged' });
  const plan = await aPlan(db, projectId, { horizon: 'week', periodStart: week });
  for (const [index, title] of ['Ship login', 'Write release notes'].entries()) {
    const item = await aPlanItem(db, plan, { title, dueDate: `2020-01-0${String(7 + index)}`, status: 'done', completedOn: '2020-01-08' });
    await withPeople(db, 'planItemAssignees', item.id, [people.grace]);
  }
  const entry = await anEntry(db, projectId, { workDate: '2020-01-07', description: 'Wired the login form', areaId: areas.frontend, pullRequestId: pr.id });
  await withPeople(db, 'entryPeople', entry.id, [people.grace, people.ali]);
  return projectId;
}

for (const scheme of ['light', 'dark'] as const) {
  test(`plans and report preview look right (${scheme})`, async ({ signedIn: page }, testInfo) => {
    test.skip(process.env['CI'] !== undefined && !existsSync(testInfo.snapshotPath(`plans-${scheme}.png`)), 'No baseline committed for this platform.');
    const projectId = await seedFixedWeek();
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.goto(`/projects/${projectId}/plans?horizon=week&date=${week}`);
    await expect(page.getByRole('main')).toHaveScreenshot(`plans-${scheme}.png`);

    await page.goto(`/projects/${projectId}/reports?kind=weekly&date=${week}`);
    const preview = page.getByRole('article', { name: 'Report preview' });
    // "Generated {today}" changes every day.
    await expect(preview).toHaveScreenshot(`report-${scheme}.png`, { mask: [preview.getByText(/Generated/)] });
  });
}
