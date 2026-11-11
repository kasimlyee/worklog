import { describe, expect, it } from 'vitest';
import { testDb } from '#tests/setup/test-db.ts';
import { aProject, aPullRequest, aRelease } from '#tests/fixtures/builders.ts';
import { createRelease, deleteRelease, getRelease, listReleases, updateRelease } from './releases.ts';
import { createNote, getNote } from './notes.ts';

describe('releases', () => {
  it('BR-32: creates a planned release with target date, notes and linked PRs', async () => {
    const project = await aProject(testDb());
    const pr1 = await aPullRequest(testDb(), project.id, { number: 2 });
    const pr2 = await aPullRequest(testDb(), project.id, { number: 1 });

    const created = await createRelease(testDb(), project.id, {
      version: '1.4.0',
      status: 'planned',
      targetDate: '2026-11-20',
      notes: '**Highlights**',
      pullRequestIds: [pr1.id, pr2.id],
    });

    expect(await getRelease(testDb(), project.id, created.ok ? created.value.id : '')).toMatchObject({
      version: '1.4.0',
      status: 'planned',
      targetDate: '2026-11-20',
      releasedOn: null,
      notesHtml: '<p><strong>Highlights</strong></p>\n',
      pullRequests: [{ number: 1 }, { number: 2 }],
    });
  });

  it('BR-32: a released release requires its released date', async () => {
    const project = await aProject(testDb());

    expect(await createRelease(testDb(), project.id, { version: '1.0', status: 'released' })).toEqual({
      ok: false,
      error: { code: 'invalid', fieldErrors: { releasedOn: 'A released version needs its released date.' } },
    });
  });

  it('BR-32: a planned release ignores a released date', async () => {
    const project = await aProject(testDb());

    const created = await createRelease(testDb(), project.id, { version: '1.0', status: 'planned', releasedOn: '2026-11-10' });

    expect((await getRelease(testDb(), project.id, created.ok ? created.value.id : ''))?.releasedOn).toBeNull();
  });

  it('BR-32: versions are unique within a project', async () => {
    const project = await aProject(testDb());
    await aRelease(testDb(), project.id, { version: '2.0' });

    expect(await createRelease(testDb(), project.id, { version: '2.0', status: 'planned' })).toEqual({
      ok: false,
      error: { code: 'invalid', fieldErrors: { version: 'This project already has a release with this version.' } },
    });
  });

  it('BR-32: linked PRs must belong to the project', async () => {
    const project = await aProject(testDb());
    const foreign = await aPullRequest(testDb(), (await aProject(testDb())).id);

    const result = await createRelease(testDb(), project.id, { version: '1', status: 'planned', pullRequestIds: [foreign.id] });

    expect(result.ok || result.error).toEqual({ code: 'invalid', fieldErrors: { pullRequestIds: 'Choose pull requests of this project.' } });
  });

  it('marks a release released and replaces its PR links', async () => {
    const project = await aProject(testDb());
    const release = await aRelease(testDb(), project.id);
    const pr = await aPullRequest(testDb(), project.id);
    await testDb().insertInto('releasePullRequests').values({ projectId: project.id, releaseId: release.id, pullRequestId: pr.id }).execute();

    const result = await updateRelease(testDb(), project.id, release.id, { version: release.version, status: 'released', releasedOn: '2026-11-10' });

    expect(result.ok).toBe(true);
    expect(await getRelease(testDb(), project.id, release.id)).toMatchObject({ status: 'released', releasedOn: '2026-11-10', pullRequests: [] });
    expect(await updateRelease(testDb(), project.id, 'bad', {})).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await updateRelease(testDb(), (await aProject(testDb())).id, release.id, { version: 'x', status: 'planned' })).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
  });

  it('lists planned releases first, then released newest first', async () => {
    const project = await aProject(testDb());
    await aRelease(testDb(), project.id, { version: 'old', status: 'released', releasedOn: '2026-10-01' });
    await aRelease(testDb(), project.id, { version: 'next', status: 'planned' });
    await aRelease(testDb(), project.id, { version: 'recent', status: 'released', releasedOn: '2026-11-01' });

    expect((await listReleases(testDb(), project.id)).map((r) => r.version)).toEqual(['next', 'recent', 'old']);
  });

  it('BR-36: deleting a release keeps its notes, detached', async () => {
    const project = await aProject(testDb());
    const release = await aRelease(testDb(), project.id);
    const note = await createNote(testDb(), project.id, { title: 'Rollout', releaseId: release.id });

    expect(await deleteRelease(testDb(), project.id, release.id)).toEqual({ ok: true, value: null });
    expect(await deleteRelease(testDb(), project.id, release.id)).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await deleteRelease(testDb(), project.id, 'bad')).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await getNote(testDb(), project.id, note.ok ? note.value.id : '')).toMatchObject({ title: 'Rollout', release: null });
    expect(await getRelease(testDb(), project.id, 'bad')).toBeNull();
  });
});
