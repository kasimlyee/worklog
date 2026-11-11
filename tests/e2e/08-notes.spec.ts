import { expect, test } from './support/fixtures.ts';
import { seedProject } from './support/seed.ts';

/* Journey 8: Markdown with a link renders; raw HTML is shown as text. */

test('BR-33, BR-34: a note renders Markdown safely', async ({ signedIn: page }) => {
  const { projectId } = await seedProject();
  const alerts: string[] = [];
  page.on('dialog', (dialog) => {
    alerts.push(dialog.message());
    void dialog.dismiss();
  });

  await page.goto(`/projects/${projectId}/notes/new`);
  const form = page.getByRole('form', { name: 'New note' });
  await form.getByLabel('Title').fill('Rollout checklist');
  await form.getByLabel('Body (Markdown)').fill('# Steps\n\n- See [the runbook](https://docs.example.com/runbook)\n\n<script>alert(1)</script><img src=x onerror="alert(2)">');
  await form.getByLabel('Link 1 label').fill('Dashboard');
  await form.getByLabel('Link 1 URL').fill('https://grafana.example.com');
  await form.getByRole('button', { name: 'Save note' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Rollout checklist' })).toBeVisible();
  const body = page.getByLabel('Note body');
  await expect(body.getByRole('heading', { name: 'Steps' })).toBeVisible();
  const runbook = body.getByRole('link', { name: 'the runbook' });
  await expect(runbook).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(runbook).toHaveAttribute('target', '_blank');
  await expect(body).toContainText('<script>alert(1)</script>');
  await expect(body.locator('script, img')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Dashboard\s*\(opens in a new tab\)$/ })).toHaveAttribute('href', 'https://grafana.example.com');
  expect(alerts).toEqual([]);

  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  const edit = page.getByRole('form', { name: 'Edit note' });
  await edit.getByLabel('Link 1 URL').fill('javascript:alert(1)');
  await edit.getByRole('button', { name: 'Save note' }).click();
  await expect(edit.getByRole('alert')).toContainText('Link must start with https:// or http://');
});
