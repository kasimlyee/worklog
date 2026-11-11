import { describe, expect, it } from 'vitest';
import { testDb } from '#tests/setup/test-db.ts';
import { aProject, anArea } from '#tests/fixtures/builders.ts';
import {
  createArea, createPerson, createProject, getProject, listAreas, listPeople, listProjects, renameArea, renamePerson,
  reorderAreas, setAreaArchived, setPersonArchived, setProjectArchived, updateProject,
} from './projects.ts';

const unknownId = '00000000-0000-4000-8000-000000000000';

describe('projects', () => {
  it('creates a project with a slug from its name', async () => {
    const result = await createProject(testDb(), { name: '  Atlas Mobile ', description: 'Field app' });

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ name: 'Atlas Mobile', slug: 'atlas-mobile', description: 'Field app', isArchived: false }),
    });
  });

  it('gives a second project with a similar name a distinct slug', async () => {
    await createProject(testDb(), { name: 'Atlas!' });

    const result = await createProject(testDb(), { name: 'Atlas?' });

    expect(result.ok && result.value.slug).toBe('atlas-2');
  });

  it('BR-05: rejects a duplicate project name with a field message', async () => {
    await createProject(testDb(), { name: 'Atlas' });

    expect(await createProject(testDb(), { name: 'Atlas' })).toEqual({
      ok: false,
      error: { code: 'invalid', fieldErrors: { name: 'A project with this name already exists.' } },
    });
  });

  it('validates required and bounded fields', async () => {
    expect(await createProject(testDb(), { name: '   ' })).toEqual({
      ok: false,
      error: { code: 'invalid', fieldErrors: { name: 'Name is required.' } },
    });
    const long = await createProject(testDb(), { name: 'x', description: 'd'.repeat(2001) });
    expect(long.ok || long.error).toEqual({ code: 'invalid', fieldErrors: { description: 'Description must be at most 2000 characters.' } });
  });

  it('renames a project, keeping its own slug free', async () => {
    const created = await createProject(testDb(), { name: 'Atlas' });
    const projectId = created.ok ? created.value.id : '';

    const renamed = await updateProject(testDb(), projectId, { name: 'Atlas', description: 'new' });
    const other = await updateProject(testDb(), projectId, { name: 'Borealis' });

    expect(renamed.ok && renamed.value.slug).toBe('atlas');
    expect(other.ok && other.value).toMatchObject({ slug: 'borealis', name: 'Borealis' });
  });

  it('BR-05: rejects renaming to another project’s name', async () => {
    await aProject(testDb(), { name: 'Taken' });
    const project = await aProject(testDb());

    const result = await updateProject(testDb(), project.id, { name: 'Taken' });

    expect(result.ok || result.error.code).toBe('invalid');
  });

  it('returns not_found for unknown or malformed ids', async () => {
    expect(await getProject(testDb(), 'nope')).toBeNull();
    expect(await getProject(testDb(), unknownId)).toBeNull();
    expect((await updateProject(testDb(), unknownId, { name: 'x' })).ok).toBe(false);
    expect(await updateProject(testDb(), 'nope', { name: 'x' })).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await setProjectArchived(testDb(), 'nope', true)).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await setProjectArchived(testDb(), unknownId, true)).toEqual({ ok: false, error: { code: 'not_found' } });
  });

  it('BR-06: archived projects leave the list but can still be read and restored', async () => {
    const project = await aProject(testDb(), { name: 'Old' });
    await aProject(testDb(), { name: 'New' });

    await setProjectArchived(testDb(), project.id, true);

    expect((await listProjects(testDb())).map((p) => p.name)).toEqual(['New']);
    expect((await listProjects(testDb(), { includeArchived: true })).map((p) => p.name)).toEqual(['New', 'Old']);
    expect(await getProject(testDb(), project.id)).toMatchObject({ isArchived: true });
    expect(await setProjectArchived(testDb(), project.id, false)).toMatchObject({ ok: true, value: { isArchived: false } });
  });
});

describe('areas', () => {
  it('BR-07: new areas go to the end of the order', async () => {
    const project = await aProject(testDb());

    await createArea(testDb(), project.id, { name: 'Frontend' });
    await createArea(testDb(), project.id, { name: 'Backend' });

    expect((await listAreas(testDb(), project.id)).map((a) => [a.name, a.position])).toEqual([
      ['Frontend', 0],
      ['Backend', 1],
    ]);
  });

  it('BR-05: area names are unique within a project, on create and rename', async () => {
    const project = await aProject(testDb());
    await createArea(testDb(), project.id, { name: 'Frontend' });
    const backend = await createArea(testDb(), project.id, { name: 'Backend' });

    const duplicate = await createArea(testDb(), project.id, { name: 'Frontend' });
    const rename = await renameArea(testDb(), project.id, backend.ok ? backend.value.id : '', { name: 'Frontend' });

    const expected = { ok: false, error: { code: 'invalid', fieldErrors: { name: 'This project already has an area with this name.' } } };
    expect(duplicate).toEqual(expected);
    expect(rename).toEqual(expected);
  });

  it('renames an area, and refuses an area of another project', async () => {
    const project = await aProject(testDb());
    const other = await aProject(testDb());
    const area = await anArea(testDb(), project.id);

    expect(await renameArea(testDb(), project.id, area.id, { name: 'Mobile' })).toMatchObject({ ok: true, value: { name: 'Mobile' } });
    expect(await renameArea(testDb(), other.id, area.id, { name: 'X' })).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await renameArea(testDb(), project.id, 'bad', { name: 'X' })).toEqual({ ok: false, error: { code: 'not_found' } });
    expect((await renameArea(testDb(), project.id, area.id, { name: '' })).ok).toBe(false);
  });

  it('BR-07: reorders active areas in one transaction, keeping archived ones after', async () => {
    const project = await aProject(testDb());
    const a = await anArea(testDb(), project.id, { name: 'A', position: 0 });
    const b = await anArea(testDb(), project.id, { name: 'B', position: 1 });
    const c = await anArea(testDb(), project.id, { name: 'C', position: 2 });
    await setAreaArchived(testDb(), project.id, a.id, true);

    const result = await reorderAreas(testDb(), project.id, { areaIds: [c.id, b.id] });

    expect(result.ok && result.value.map((area) => area.name)).toEqual(['C', 'B']);
    const all = await listAreas(testDb(), project.id, { includeArchived: true });
    expect(all.map((area) => [area.name, area.position])).toEqual([['C', 0], ['B', 1], ['A', 2]]);
  });

  it('BR-07: refuses a reorder that does not list exactly the active areas', async () => {
    const project = await aProject(testDb());
    const a = await anArea(testDb(), project.id);
    const b = await anArea(testDb(), project.id);

    for (const areaIds of [[a.id], [a.id, a.id], [a.id, b.id, a.id]]) {
      expect((await reorderAreas(testDb(), project.id, { areaIds })).ok).toBe(false);
    }
    expect((await reorderAreas(testDb(), project.id, { areaIds: [] })).ok).toBe(false);
  });

  it('BR-06: archived areas disappear from pickers and can be restored', async () => {
    const project = await aProject(testDb());
    const area = await anArea(testDb(), project.id);

    await setAreaArchived(testDb(), project.id, area.id, true);
    expect(await listAreas(testDb(), project.id)).toEqual([]);

    expect(await setAreaArchived(testDb(), project.id, area.id, false)).toMatchObject({ ok: true, value: { isArchived: false } });
    expect(await setAreaArchived(testDb(), project.id, 'bad', false)).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await setAreaArchived(testDb(), project.id, project.id, false)).toEqual({ ok: false, error: { code: 'not_found' } });
  });
});

describe('people', () => {
  it('BR-05: people names are unique; BR-06: archiving hides them from pickers', async () => {
    const grace = await createPerson(testDb(), { name: 'Grace' });
    await createPerson(testDb(), { name: 'Ali' });
    const graceId = grace.ok ? grace.value.id : '';

    expect((await createPerson(testDb(), { name: 'Grace' })).ok).toBe(false);
    expect((await renamePerson(testDb(), graceId, { name: 'Ali' })).ok).toBe(false);
    await setPersonArchived(testDb(), graceId, true);
    expect((await listPeople(testDb())).map((p) => p.name)).toEqual(['Ali']);
    expect((await listPeople(testDb(), { includeArchived: true })).map((p) => p.name)).toEqual(['Ali', 'Grace']);
  });

  it('renames a person and handles unknown ids', async () => {
    const created = await createPerson(testDb(), { name: 'Gracie' });

    expect(await renamePerson(testDb(), created.ok ? created.value.id : '', { name: 'Grace' })).toMatchObject({ ok: true, value: { name: 'Grace' } });
    expect(await renamePerson(testDb(), 'bad', { name: 'X' })).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await renamePerson(testDb(), '00000000-0000-4000-8000-000000000000', { name: 'X' })).toEqual({ ok: false, error: { code: 'not_found' } });
    expect((await renamePerson(testDb(), 'bad', { name: '' })).ok).toBe(false);
    expect((await createPerson(testDb(), {})).ok).toBe(false);
    expect(await setPersonArchived(testDb(), 'bad', true)).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await setPersonArchived(testDb(), '00000000-0000-4000-8000-000000000000', true)).toEqual({ ok: false, error: { code: 'not_found' } });
  });
});
