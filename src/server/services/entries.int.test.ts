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
      planItemIds: [item.id],
      issueIds: [issue.id],
    });

    const entry = await getEntry(testDb(), project.id, created.ok ? created.value.id : '');
    expect(entry).toEqual({
      id: anyString,
      workDate: '2026-11-10',
      description: 'Fixed the token refresh',
      area: { id: area.id, name: 'Backend' },
      people: [{ id: ali.id, name: 'Ali' }, { id: grace.id, name: 'Grace' }],
      pullRequests: [objectContaining({ number: 12, title: 'PR 12', url: 'https://github.com/acme/app/pull/12' })],
      planItems: [{ id: item.id, title: 'Ship login', completes: false }],
      issues: [{ id: issue.id, title: 'Crash on save', summary: '', cause: '', fix: '', resolves: false }],
    });
  });

  it('BR-44: a log closes the issues it fixes — on the work date, by its first pull request, with Issue / Cause / Fix', async () => {
    const { project, grace } = await setup();
    const crash = await anIssue(testDb(), project.id, { title: 'Crash on save' });
    const alreadyFixed = await anIssue(testDb(), project.id, { title: 'Old bug', status: 'resolved', resolvedOn: '2026-11-03' });
    const partial = await anIssue(testDb(), project.id, { title: 'Partly done' });
    await anIssue(testDb(), project.id, { title: 'Not linked' });

    const created = await createEntry(prDeps(testDb()), project.id, {
      workDate: '2026-11-10',
      description: 'Fixed the crash',
      personIds: [grace.id],
      prUrls: 'https://github.com/acme/app/pull/12\nhttps://github.com/acme/api/pull/40',
      issueIds: [crash.id, alreadyFixed.id, partial.id],
      [`issue.${crash.id}.summary`]: 'Saving crashed',
      [`issue.${crash.id}.cause`]: 'Full-size decode',
      [`issue.${crash.id}.fix`]: 'Decode thumbnails',
      [`issue.${crash.id}.resolves`]: 'on',
      [`issue.${alreadyFixed.id}.fix`]: 'Again',
      [`issue.${alreadyFixed.id}.resolves`]: 'on',
      [`issue.${partial.id}.cause`]: 'Two causes; one fixed',
    });

    expect(created.ok).toBe(true);
    const entry = await getEntry(testDb(), project.id, created.ok ? created.value.id : '');
    const issues = await testDb().selectFrom('issues').select(['title', 'status', 'resolvedOn', 'resolvedByPrId']).where('projectId', '=', project.id).orderBy('title').execute();
    expect(issues).toEqual([
      { title: 'Crash on save', status: 'resolved', resolvedOn: '2026-11-10', resolvedByPrId: entry?.pullRequests.find((pr) => pr.number === 12)?.id },
      { title: 'Not linked', status: 'open', resolvedOn: null, resolvedByPrId: null },
      // Already resolved: its resolution is kept as it was.
      { title: 'Old bug', status: 'resolved', resolvedOn: '2026-11-03', resolvedByPrId: null },
      // Linked without “This fixes it”: worked on, still open.
      { title: 'Partly done', status: 'open', resolvedOn: null, resolvedByPrId: null },
    ]);
    expect(entry?.issues.find((issue) => issue.id === crash.id)).toEqual({
      id: crash.id, title: 'Crash on save', summary: 'Saving crashed', cause: 'Full-size decode', fix: 'Decode thumbnails', resolves: true,
    });
  });

  it('BR-50: fixing an issue finishes the open plan items working on it, on the work date', async () => {
    const { project, grace } = await setup();
    const bug = await anIssue(testDb(), project.id, { title: 'Calendar empty' });
    const unfixed = await anIssue(testDb(), project.id, { title: 'Still open' });
    const plan = await aPlan(testDb(), project.id);
    const today = await aPlanItem(testDb(), plan, { title: 'Calendar empty', issueId: bug.id });
    const earlier = await aPlanItem(testDb(), plan, { title: 'Done before', issueId: bug.id, status: 'done', completedOn: '2026-11-09' });
    const other = await aPlanItem(testDb(), plan, { title: 'Still open', issueId: unfixed.id });

    const created = await createEntry(prDeps(testDb()), project.id, {
      workDate: '2026-11-10',
      description: 'Calendar shows new bookings',
      personIds: [grace.id],
      issueIds: [bug.id, unfixed.id],
      [`issue.${bug.id}.fix`]: 'Count new bookings',
      [`issue.${bug.id}.resolves`]: 'on',
      [`issue.${unfixed.id}.cause`]: 'Looked into it',
    });

    expect(created.ok).toBe(true);
    const rows = await testDb().selectFrom('planItems').select(['id', 'status', 'completedOn']).where('id', 'in', [today.id, earlier.id, other.id]).execute();
    const byId = new Map(rows.map((row) => [row.id, [row.status, row.completedOn]]));
    expect([byId.get(today.id), byId.get(earlier.id), byId.get(other.id)]).toEqual([
      ['done', '2026-11-10'],
      ['done', '2026-11-09'],
      ['planned', null],
    ]);
  });

  it('BR-44: closing an issue needs the fix; each note is at most 1000 characters', async () => {
    const { project, grace } = await setup();
    const crash = await anIssue(testDb(), project.id);

    const result = await createEntry(prDeps(testDb()), project.id, {
      workDate: '2026-11-10',
      description: 'x',
      personIds: [grace.id],
      issueIds: [crash.id],
      [`issue.${crash.id}.cause`]: 'c'.repeat(1001),
      [`issue.${crash.id}.resolves`]: 'on',
    });

    expect(result.ok ? null : result.error).toEqual({
      code: 'invalid',
      fieldErrors: {
        [`issue.${crash.id}.cause`]: 'Cause must be at most 1000 characters.',
      },
    });
    const noFix = await createEntry(prDeps(testDb()), project.id, {
      workDate: '2026-11-10', description: 'x', personIds: [grace.id], issueIds: [crash.id], [`issue.${crash.id}.resolves`]: 'on',
    });
    expect(noFix.ok ? null : noFix.error).toEqual({ code: 'invalid', fieldErrors: { [`issue.${crash.id}.fix`]: 'Say what the fix was before closing the issue.' } });
    expect(await testDb().selectFrom('entries').selectAll().execute()).toEqual([]);
  });

  it('BR-45: a log finishes the plan items it says it finishes, as of the work date; BR-39 their issue resolves too', async () => {
    const { project, grace } = await setup();
    const issue = await anIssue(testDb(), project.id, { title: 'From an issue' });
    const plan = await aPlan(testDb(), project.id);
    const finished = await aPlanItem(testDb(), plan, { title: 'Finished', issueId: issue.id });
    const touched = await aPlanItem(testDb(), plan, { title: 'Touched' });

    await createEntry(prDeps(testDb()), project.id, {
      workDate: '2026-11-09',
      description: 'x',
      personIds: [grace.id],
      planItemIds: [finished.id, touched.id],
      [`planItem.${finished.id}.completes`]: 'on',
    });

    const items = await testDb().selectFrom('planItems').select(['title', 'status', 'completedOn']).orderBy('title').execute();
    expect(items).toEqual([
      { title: 'Finished', status: 'done', completedOn: '2026-11-09' },
      { title: 'Touched', status: 'planned', completedOn: null },
    ]);
    expect(await testDb().selectFrom('issues').select(['status', 'resolvedOn']).where('id', '=', issue.id).executeTakeFirst()).toEqual({
      status: 'resolved',
      resolvedOn: '2026-11-09',
    });
  });

  it('BR-44/BR-45: editing a log can close work; unticking never reopens it', async () => {
    const { project, grace } = await setup();
    const crash = await anIssue(testDb(), project.id);
    const created = await createEntry(prDeps(testDb()), project.id, { workDate: '2026-11-10', description: 'x', personIds: [grace.id], issueIds: [crash.id] });
    const id = created.ok ? created.value.id : '';

    await updateEntry(prDeps(testDb()), project.id, id, {
      workDate: '2026-11-10', description: 'x', personIds: [grace.id], issueIds: [crash.id], [`issue.${crash.id}.fix`]: 'Done', [`issue.${crash.id}.resolves`]: 'on',
    });
    expect(await testDb().selectFrom('issues').select('status').where('id', '=', crash.id).executeTakeFirst()).toEqual({ status: 'resolved' });

    await updateEntry(prDeps(testDb()), project.id, id, { workDate: '2026-11-10', description: 'x', personIds: [grace.id], issueIds: [crash.id] });
    expect(await testDb().selectFrom('issues').select('status').where('id', '=', crash.id).executeTakeFirst()).toEqual({ status: 'resolved' });
  });

  it('BR-46: a log carries several pull requests, one per line; at most five', async () => {
    const { project, grace } = await setup();

    const created = await createEntry(prDeps(testDb()), project.id, {
      workDate: '2026-11-10',
      description: 'Front end and back end',
      personIds: [grace.id],
      prUrls: ' https://github.com/acme/web/pull/7 \n\nhttps://github.com/acme/api/pull/3\nhttps://github.com/acme/web/pull/7',
    });

    const entry = await getEntry(testDb(), project.id, created.ok ? created.value.id : '');
    expect(entry?.pullRequests.map((pr) => `${pr.repo}#${String(pr.number)}`)).toEqual(['api#3', 'web#7']);
    const tooMany = await createEntry(prDeps(testDb()), project.id, {
      workDate: '2026-11-10',
      description: 'x',
      personIds: [grace.id],
      prUrls: [1, 2, 3, 4, 5, 6].map((n) => `https://github.com/acme/app/pull/${String(n)}`).join('\n'),
    });
    expect(tooMany.ok ? null : tooMany.error).toEqual({ code: 'invalid', fieldErrors: { prUrls: 'Link at most 5 pull requests.' } });
  });

  it('BR-20: linking an issue without “This fixes it” leaves it open', async () => {
    const { project, grace } = await setup();
    const crash = await anIssue(testDb(), project.id, { title: 'Crash on save' });

    await createEntry(prDeps(testDb()), project.id, { workDate: '2026-11-10', description: 'Looked into it', personIds: [grace.id], issueIds: [crash.id] });

    expect(await testDb().selectFrom('issues').select('status').where('id', '=', crash.id).executeTakeFirst()).toEqual({ status: 'open' });
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

  it('BR-17: one entry can relate to several issues and fulfil several plan items (one PR, many fixes)', async () => {
    const { project, grace } = await setup();
    const shareLinks = await anIssue(testDb(), project.id, { title: 'Share links broken', deadline: '2026-11-12' });
    const preview = await anIssue(testDb(), project.id, { title: 'No link preview', deadline: '2026-11-13' });
    const plan = await aPlan(testDb(), project.id, { horizon: 'week', periodStart: '2026-11-09' });
    const moveVm = await aPlanItem(testDb(), plan, { title: 'Move domain', dueDate: '2026-11-10' });
    const ssr = await aPlanItem(testDb(), plan, { title: 'Server-render share pages', dueDate: '2026-11-11' });

    const created = await createEntry(prDeps(testDb()), project.id, {
      workDate: '2026-11-10',
      description: 'Moved go.nestlyhousing.org; share pages are now server-rendered',
      personIds: [grace.id],
      prUrl: 'https://github.com/acme/web/pull/41',
      issueIds: [preview.id, shareLinks.id],
      planItemIds: [ssr.id, moveVm.id],
    });
    const entryId = created.ok ? created.value.id : '';

    expect(await getEntry(testDb(), project.id, entryId)).toMatchObject({
      issues: [{ title: 'Share links broken' }, { title: 'No link preview' }],
      planItems: [{ title: 'Move domain' }, { title: 'Server-render share pages' }],
    });

    // Editing replaces the whole set.
    await updateEntry(prDeps(testDb()), project.id, entryId, { workDate: '2026-11-10', description: 'x', personIds: [grace.id], issueIds: [preview.id] });
    expect(await getEntry(testDb(), project.id, entryId)).toMatchObject({ issues: [{ title: 'No link preview' }], planItems: [] });
  });

  it('BR-17: the log can be filtered to the entries of one issue or plan item, whichever else they link to', async () => {
    const { project } = await setup();
    const a = await anIssue(testDb(), project.id);
    const b = await anIssue(testDb(), project.id);
    const both = await anEntry(testDb(), project.id, { issueIds: [a.id, b.id] });
    await anEntry(testDb(), project.id, { issueIds: [a.id] });

    const ids = async (issueId: string) => (await listEntries(testDb(), project.id, { issueId })).entries.map((e) => e.id);
    expect(await ids(b.id)).toEqual([both.id]);
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
      issueIds: [issue.id],
      planItemIds: [item.id],
      prUrl: 'https://github.com/acme/app/pull/1',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'invalid',
        fieldErrors: {
          areaId: 'Choose an area of this project.',
          issueIds: 'Choose issues of this project.',
          planItemIds: 'Choose plan items of this project.',
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
    expect(entry?.pullRequests[0]?.id).not.toBe(foreign.id);
  });

  it('BR-26: a GitHub failure on the PR link stops the entry and reports on prUrls', async () => {
    const { project, grace } = await setup();

    const result = await createEntry(prDeps(testDb()), project.id, {
      workDate: '2026-11-10',
      description: 'x',
      personIds: [grace.id],
      prUrl: 'https://github.com/other/app/pull/5',
    });

    expect(result.ok || Object.keys(result.error.code === 'invalid' ? result.error.fieldErrors : {})).toEqual(['prUrls']);
    expect(await testDb().selectFrom('entries').selectAll().execute()).toEqual([]);
  });

  it('BR-20: linking an entry to a plan item does not change the item’s status', async () => {
    const { project, grace } = await setup();
    const item = await aPlanItem(testDb(), await aPlan(testDb(), project.id));

    await createEntry(prDeps(testDb()), project.id, { workDate: '2026-11-10', description: 'x', personIds: [grace.id], planItemIds: [item.id] });

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
      pullRequests: [],
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

  it('option B: searches descriptions, Issue / Cause / Fix notes, linked issue titles and PR titles', async () => {
    const { project, grace } = await setup();
    const issue = await anIssue(testDb(), project.id, { title: 'Share links broken' });
    const pr = await aPullRequest(testDb(), project.id, { title: 'feat: broker notifications' });
    const byText = await anEntry(testDb(), project.id, { description: 'Moved the short-link domain' });
    const byNote = await anEntry(testDb(), project.id, { description: 'Investigated' });
    await testDb().insertInto('entryIssues').values({ projectId: project.id, entryId: byNote.id, issueId: issue.id, cause: 'DNS pointed at the OLD server' }).execute();
    const byPr = await anEntry(testDb(), project.id, { description: 'Shipped', pullRequestId: pr.id });
    await anEntry(testDb(), project.id, { description: 'Unrelated 100% done_now' });
    for (const entry of [byText, byNote, byPr]) {
      await withPeople(testDb(), 'entryPeople', entry.id, [grace.id]);
    }
    const found = async (q: string) => (await listEntries(testDb(), project.id, { q })).entries.map((entry) => entry.description).sort();

    expect(await found('short-link')).toEqual(['Moved the short-link domain']);
    expect(await found('old server')).toEqual(['Investigated']);
    expect(await found('share links')).toEqual(['Investigated']);
    expect(await found('NOTIFICATIONS')).toEqual(['Shipped']);
    // LIKE wildcards are matched literally.
    expect(await found('100%')).toEqual(['Unrelated 100% done_now']);
    expect(await found('o_n')).toEqual([]);
    expect((await listEntries(testDb(), project.id, { q: '   ' })).entries).toHaveLength(4);
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
