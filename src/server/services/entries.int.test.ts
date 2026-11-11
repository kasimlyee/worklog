import { describe, expect, it } from 'vitest';
import { anyString, objectContaining } from '#tests/fixtures/matchers.ts';
import { testDb, countQueries } from '#tests/setup/test-db.ts';
import { fakeGitHub, prDeps } from '#tests/fixtures/github.ts';
import {
  aPerson, aPlan, aPlanItem, aProject, aPullRequest, anArea, anEntry, anIssue, withPeople,
} from '#tests/fixtures/builders.ts';
import { createEntry, deleteEntry, getEntry, listEntries, updateEntry } from './entries.ts';

async function setup() {
  const project = await aProject(testDb());
  const grace = await aPerson(testDb(), { name: 'Grace' });
  const ali = await aPerson(testDb(), { name: 'Ali' });
  return { project, grace, ali };
}

describe('entries', () => {
  it('BR-17: creates an entry with area, people, PR, plan item and issue', async () => {
    const { project, grace, ali } = await setup();
    const area = await anArea(testDb(), project.id, { name: 'Backend' });
    const issue = await anIssue(testDb(), project.id, { title: 'Crash on save' });
    const item = await aPlanItem(testDb(), await aPlan(testDb(), project.id), { title: 'Ship login' });

    const created = await createEntry(prDeps(testDb()), project.id, {
      workDate: '2026-11-10',
      description: '  Fixed the token refresh  ',
      areaId: area.id,
      personIds: [grace.id, ali.id],
      prUrl: 'https://github.com/acme/app/pull/12',
      planItemId: item.id,
      issueId: issue.id,
    });

    const entry = await getEntry(testDb(), project.id, created.ok ? created.value.id : '');
    expect(entry).toEqual({
      id: anyString,
      workDate: '2026-11-10',
      description: 'Fixed the token refresh',
      area: { id: area.id, name: 'Backend' },
      people: [{ id: ali.id, name: 'Ali' }, { id: grace.id, name: 'Grace' }],
      pullRequest: objectContaining({ number: 12, title: 'PR 12', url: 'https://github.com/acme/app/pull/12' }),
      planItem: { id: item.id, title: 'Ship login' },
      issue: { id: issue.id, title: 'Crash on save' },
    });
  });

  it('BR-17: needs a description, a valid date and at least one person', async () => {
    const { project } = await setup();

    const result = await createEntry(prDeps(testDb()), project.id, { workDate: '2026-02-30', description: '', personIds: [] });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'invalid',
        fieldErrors: {
          workDate: 'Date must be a valid date.',
          description: 'Description is required.',
          personIds: 'Choose at least one person.',
        },
      },
    });
  });

  it('BR-18: records work on a Saturday or Sunday', async () => {
    const { project, grace } = await setup();

    const result = await createEntry(prDeps(testDb()), project.id, { workDate: '2026-11-14', description: 'Hotfix', personIds: grace.id });

    expect(result.ok).toBe(true);
  });

  it('BR-19: refuses an area, plan item, issue or person that is not part of this project', async () => {
    const { project, grace } = await setup();
    const other = await aProject(testDb());
    const area = await anArea(testDb(), other.id);
    const issue = await anIssue(testDb(), other.id);
    const item = await aPlanItem(testDb(), await aPlan(testDb(), other.id));
    const github = fakeGitHub();

    const result = await createEntry(prDeps(testDb(), github), project.id, {
      workDate: '2026-11-10',
      description: 'x',
      personIds: [grace.id, '00000000-0000-4000-8000-000000000000'],
      areaId: area.id,
      issueId: issue.id,
      planItemId: item.id,
      prUrl: 'https://github.com/acme/app/pull/1',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'invalid',
        fieldErrors: {
          areaId: 'Choose an area of this project.',
          issueId: 'Choose an issue of this project.',
          planItemId: 'Choose a plan item of this project.',
          personIds: 'One of the chosen people no longer exists.',
        },
      },
    });
    expect(github.fetchPullRequest).not.toHaveBeenCalled();
  });

  it('BR-19: a PR URL resolves to this project’s own PR record', async () => {
    const { project, grace } = await setup();
    const other = await aProject(testDb());
    const foreign = await aPullRequest(testDb(), other.id, { owner: 'acme', repo: 'app', number: 5 });

    const created = await createEntry(prDeps(testDb()), project.id, {
      workDate: '2026-11-10',
      description: 'x',
      personIds: [grace.id],
      prUrl: 'https://github.com/acme/app/pull/5',
    });

    const entry = await getEntry(testDb(), project.id, created.ok ? created.value.id : '');
    expect(entry?.pullRequest?.id).not.toBe(foreign.id);
  });

  it('BR-26: a GitHub failure on the PR link stops the entry and reports on prUrl', async () => {
    const { project, grace } = await setup();

    const result = await createEntry(prDeps(testDb()), project.id, {
      workDate: '2026-11-10',
      description: 'x',
      personIds: [grace.id],
      prUrl: 'https://github.com/other/app/pull/5',
    });

    expect(result.ok || Object.keys(result.error.code === 'invalid' ? result.error.fieldErrors : {})).toEqual(['prUrl']);
    expect(await testDb().selectFrom('entries').selectAll().execute()).toEqual([]);
  });

  it('BR-20: linking an entry to a plan item does not change the item’s status', async () => {
    const { project, grace } = await setup();
    const item = await aPlanItem(testDb(), await aPlan(testDb(), project.id));

    await createEntry(prDeps(testDb()), project.id, { workDate: '2026-11-10', description: 'x', personIds: [grace.id], planItemId: item.id });

    const row = await testDb().selectFrom('planItems').select('status').executeTakeFirstOrThrow();
    expect(row.status).toBe('planned');
  });

  it('edits an entry, replacing its people and links', async () => {
    const { project, grace, ali } = await setup();
    const entry = await anEntry(testDb(), project.id, { description: 'old' });
    await withPeople(testDb(), 'entryPeople', entry.id, [grace.id]);

    const result = await updateEntry(prDeps(testDb()), project.id, entry.id, {
      workDate: '2026-11-11',
      description: 'new',
      personIds: [ali.id],
      prUrl: '',
    });

    expect(result).toEqual({ ok: true, value: { id: entry.id } });
    expect(await getEntry(testDb(), project.id, entry.id)).toMatchObject({
      workDate: '2026-11-11',
      description: 'new',
      people: [{ name: 'Ali' }],
      pullRequest: null,
    });
  });

  it('edit and delete refuse entries of another project', async () => {
    const { project, grace } = await setup();
    const other = await aProject(testDb());
    const entry = await anEntry(testDb(), other.id);
    const input = { workDate: '2026-11-11', description: 'x', personIds: [grace.id] };

    expect(await updateEntry(prDeps(testDb()), project.id, entry.id, input)).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await updateEntry(prDeps(testDb()), project.id, 'bad', input)).toEqual({ ok: false, error: { code: 'not_found' } });
    expect((await updateEntry(prDeps(testDb()), project.id, entry.id, {})).ok).toBe(false);
    expect(await deleteEntry(testDb(), project.id, entry.id)).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await deleteEntry(testDb(), project.id, 'bad')).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await getEntry(testDb(), project.id, entry.id)).toBeNull();
    expect(await getEntry(testDb(), project.id, 'bad')).toBeNull();
  });

  it('BR-36: deletes an entry', async () => {
    const { project } = await setup();
    const entry = await anEntry(testDb(), project.id);

    expect(await deleteEntry(testDb(), project.id, entry.id)).toEqual({ ok: true, value: null });
    expect(await getEntry(testDb(), project.id, entry.id)).toBeNull();
  });
});

describe('log list', () => {
  it('lists newest first and pages by keyset without gaps or repeats', async () => {
    const { project } = await setup();
    for (const workDate of ['2026-11-09', '2026-11-10', '2026-11-10', '2026-11-11', '2026-11-12']) {
      await anEntry(testDb(), project.id, { workDate });
    }

    const first = await listEntries(testDb(), project.id, {}, 2);
    const second = await listEntries(testDb(), project.id, { cursor: first.nextCursor }, 2);
    const third = await listEntries(testDb(), project.id, { cursor: second.nextCursor }, 2);

    const dates = [...first.entries, ...second.entries, ...third.entries].map((e) => e.workDate);
    expect(dates).toEqual(['2026-11-12', '2026-11-11', '2026-11-10', '2026-11-10', '2026-11-09']);
    expect(new Set([...first.entries, ...second.entries, ...third.entries].map((e) => e.id)).size).toBe(5);
    expect(third.nextCursor).toBeNull();
  });

  it('filters by area, person and PR', async () => {
    const { project, grace } = await setup();
    const area = await anArea(testDb(), project.id);
    const pr = await aPullRequest(testDb(), project.id);
    const byArea = await anEntry(testDb(), project.id, { areaId: area.id });
    const byPr = await anEntry(testDb(), project.id, { pullRequestId: pr.id });
    const byPerson = await anEntry(testDb(), project.id);
    await withPeople(testDb(), 'entryPeople', byPerson.id, [grace.id]);

    const ids = async (query: object) => (await listEntries(testDb(), project.id, query)).entries.map((e) => e.id);

    expect(await ids({ areaId: area.id })).toEqual([byArea.id]);
    expect(await ids({ pullRequestId: pr.id })).toEqual([byPr.id]);
    expect(await ids({ personId: grace.id })).toEqual([byPerson.id]);
  });

  it('ignores malformed filters and cursors instead of failing', async () => {
    const { project } = await setup();
    await anEntry(testDb(), project.id);

    for (const query of [{ areaId: 'x', cursor: 'garbage' }, { cursor: Buffer.from('[1,2,3]').toString('base64url') }, null]) {
      expect((await listEntries(testDb(), project.id, query)).entries).toHaveLength(1);
    }
  });

  it('loads a page in one query regardless of size', async () => {
    const { project, grace, ali } = await setup();
    for (let i = 0; i < 20; i += 1) {
      const entry = await anEntry(testDb(), project.id);
      await withPeople(testDb(), 'entryPeople', entry.id, [grace.id, ali.id]);
    }

    expect(await countQueries(() => listEntries(testDb(), project.id, {}))).toBe(1);
  });
});
