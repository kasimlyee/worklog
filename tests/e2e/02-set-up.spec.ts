import { expect, test } from './support/fixtures.ts';

/* Journey 2: create a project, add and reorder areas, add people. */

test('set up a project with areas and people', async ({ signedIn: page }) => {
  await page.goto('/projects');
  await expect(page.getByText('No projects yet. Create the first one below.')).toBeVisible();

  const create = page.getByRole('form', { name: 'New project' });
  await create.getByLabel('Name').fill('Atlas');
  await create.getByLabel('Description').fill('Field service app');
  await create.getByRole('button', { name: 'Create project' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  for (const area of ['Frontend', 'Backend', 'Mobile']) {
    const addArea = page.getByRole('form', { name: 'Add area' });
    await addArea.getByLabel('Area name').fill(area);
    await addArea.getByRole('button', { name: 'Add area' }).click();
    await expect(page.getByRole('form', { name: `Rename ${area}` })).toBeVisible();
  }

  // Reorder from the keyboard: Mobile up twice.
  await page.getByRole('button', { name: 'Move Mobile up' }).click();
  await page.getByRole('button', { name: 'Move Mobile up' }).click();
  await page.getByRole('button', { name: 'Save order' }).click();
  await expect(page.getByRole('form', { name: 'Area order' }).getByRole('status')).toHaveText('Order saved.');
  await page.reload();
  const names = await page.getByRole('form', { name: /^Rename / }).getByLabel('Area name').evaluateAll((inputs) =>
    inputs.map((input) => (input instanceof HTMLInputElement ? input.value : '')),
  );
  expect(names).toEqual(['Mobile', 'Frontend', 'Backend']);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'People' }).click();
  for (const person of ['Ali', 'Grace']) {
    const add = page.getByRole('form', { name: 'Add person' });
    await add.getByLabel('Name').fill(person);
    await add.getByRole('button', { name: 'Add person' }).click();
    await expect(page.getByRole('form', { name: `Rename ${person}` })).toBeVisible();
  }

  await page.getByRole('button', { name: 'Archive Ali' }).click();
  await expect(page.getByRole('button', { name: 'Restore Ali' })).toBeVisible();
  await page.getByRole('button', { name: 'Restore Ali' }).click();
  await expect(page.getByRole('button', { name: 'Archive Ali' })).toBeVisible();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Projects' }).click();
  await expect(page.getByRole('link', { name: 'Atlas' })).toBeVisible();
  await expect(page.getByText('Nothing overdue')).toBeVisible();
});

test('BR-05: a duplicate project name shows a message next to the field and keeps the input', async ({ signedIn: page }) => {
  await page.goto('/projects');
  const create = page.getByRole('form', { name: 'New project' });
  await create.getByLabel('Name').fill('Atlas');
  await create.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await page.goto('/projects');

  await create.getByLabel('Name').fill('Atlas');
  await create.getByRole('button', { name: 'Create project' }).click();

  await expect(create.getByRole('alert')).toContainText('A project with this name already exists.');
  await expect(create.getByLabel('Name')).toHaveValue('Atlas');
  await expect(create.getByLabel('Name')).toHaveAttribute('aria-invalid', 'true');
});
