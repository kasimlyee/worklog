import { describe, expect, it } from 'vitest';
import { testDb } from '#tests/setup/test-db.ts';
import { aProject, aPullRequest, aRelease } from '#tests/fixtures/builders.ts';
import { createNote, deleteNote, getNote, listNotes, updateNote } from './notes.ts';
import { getReportNote, saveReportNote } from './report-notes.ts';
import { isoDate as d } from '#src/server/domain/calendar.ts';

describe('notes', () => {
  it('BR-33: stores Markdown and renders it with raw HTML as text', async () => {
    const project = await aProject(testDb());

    const created = await createNote(testDb(), project.id, { title: 'Runbook', body: '# Steps\n<script>alert(1)</script>' });

    const note = await getNote(testDb(), project.id, created.ok ? created.value.id : '');
    expect(note?.body).toBe('# Steps\n<script>alert(1)</script>');
    expect(note?.bodyHtml).toBe('<h1>Steps</h1>\n<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>\n');
  });

  it('BR-34: external links must be http(s); blank link rows are ignored', async () => {
    const project = await aProject(testDb());

    const bad = await createNote(testDb(), project.id, { title: 'x', links: [{ label: 'x', url: 'javascript:alert(1)' }] });
    const good = await createNote(testDb(), project.id, {
      title: 'x',
      links: [{ label: 'Spec', url: 'https://docs.example.com' }, { label: '', url: '  ' }],
    });

    expect(bad).toEqual({ ok: false, error: { code: 'invalid', fieldErrors: { links: 'Link must start with https:// or http://' } } });
    expect((await getNote(testDb(), project.id, good.ok ? good.value.id : ''))?.links).toEqual([{ label: 'Spec', url: 'https://docs.example.com' }]);
  });

  it('BR-35: a note may be attached to a release or a PR of the same project', async () => {
    const project = await aProject(testDb());
    const release = await aRelease(testDb(), project.id, { version: '3.1' });
    const pr = await aPullRequest(testDb(), project.id, { number: 9 });
    const foreign = await aRelease(testDb(), (await aProject(testDb())).id);

    const created = await createNote(testDb(), project.id, { title: 'x', releaseId: release.id, pullRequestId: pr.id });
    const refused = await createNote(testDb(), project.id, { title: 'x', releaseId: foreign.id });

    expect(await getNote(testDb(), project.id, created.ok ? created.value.id : '')).toMatchObject({
      release: { id: release.id, version: '3.1' },
      pullRequest: { number: 9 },
    });
    expect(refused.ok || refused.error).toEqual({ code: 'invalid', fieldErrors: { releaseId: 'Choose a release of this project.' } });
    expect((await listNotes(testDb(), project.id, { releaseId: release.id })).length).toBe(1);
  });

  it('edits, lists and deletes notes', async () => {
    const project = await aProject(testDb());
    const created = await createNote(testDb(), project.id, { title: 'Draft', links: [{ label: 'a', url: 'https://a.example' }] });
    const noteId = created.ok ? created.value.id : '';

    expect((await updateNote(testDb(), project.id, noteId, { title: 'Final', body: 'Done' })).ok).toBe(true);
    expect(await listNotes(testDb(), project.id)).toMatchObject([{ title: 'Final', body: 'Done', links: [] }]);
    expect(await updateNote(testDb(), project.id, 'bad', { title: 'x' })).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await updateNote(testDb(), (await aProject(testDb())).id, noteId, { title: 'x' })).toEqual({ ok: false, error: { code: 'not_found' } });
    expect((await updateNote(testDb(), project.id, noteId, { title: '' })).ok).toBe(false);
    expect(await deleteNote(testDb(), project.id, noteId)).toEqual({ ok: true, value: null });
    expect(await deleteNote(testDb(), project.id, noteId)).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await deleteNote(testDb(), project.id, 'bad')).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await getNote(testDb(), project.id, 'bad')).toBeNull();
  });
});

describe('report notes', () => {
  it('R-04: saves, replaces and clears the note of one report', async () => {
    const project = await aProject(testDb());
    const week = { kind: 'weekly', periodStart: '2026-11-09' };

    await saveReportNote(testDb(), project.id, { ...week, body: 'Short week.' });
    await saveReportNote(testDb(), project.id, { ...week, body: 'Short week: public holiday.' });
    expect(await getReportNote(testDb(), project.id, 'weekly', d('2026-11-09'))).toBe('Short week: public holiday.');
    expect(await getReportNote(testDb(), project.id, 'daily', d('2026-11-09'))).toBe('');

    await saveReportNote(testDb(), project.id, { ...week, body: '  ' });
    expect(await getReportNote(testDb(), project.id, 'weekly', d('2026-11-09'))).toBe('');
  });

  it('R-04: refuses a period that does not start a report', async () => {
    const project = await aProject(testDb());

    expect((await saveReportNote(testDb(), project.id, { kind: 'monthly', periodStart: '2026-11-09', body: 'x' })).ok).toBe(false);
    expect((await saveReportNote(testDb(), project.id, { kind: 'yearly', periodStart: '2026-11-01', body: 'x' })).ok).toBe(false);
  });
});
