import { describe, expect, it } from 'vitest';
import { testDb } from '#tests/setup/test-db.ts';
import { prDeps } from '#tests/fixtures/github.ts';
import { aPerson, aProject } from '#tests/fixtures/builders.ts';
import { createEntry, getEntry } from './entries.ts';
import { createIssue, getIssue } from './issues.ts';
import { createNote, getNote } from './notes.ts';
import { createProject, getProject } from './projects.ts';
import { isoDate as d } from '#src/server/domain/calendar.ts';

/* docs/04 §4.3: hostile strings round-trip unchanged (or are refused) — never a 500. */

const payloads = [
  "Robert'); DROP TABLE entries;--",
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  '${7*7} {{7*7}} %s %n',
  '\\x00 \\u0000 \\\\',
  'Ünïcödé — 中文 — 😀 — ‮right-to-left',
  'line one\nline two\ttabbed',
];

describe('hostile text', () => {
  it.each(payloads)('round-trips unchanged through entries, issues, notes and projects: %j', async (payload) => {
    const project = await aProject(testDb());
    const person = await aPerson(testDb());

    const entry = await createEntry(prDeps(testDb()), project.id, { workDate: '2026-11-10', description: payload, personIds: [person.id] });
    const issue = await createIssue(testDb(), project.id, { title: payload.slice(0, 200), personIds: [person.id], assignedOn: '2026-11-10', deadline: '2026-11-10' });
    const note = await createNote(testDb(), project.id, { title: payload.slice(0, 200), body: payload });
    const created = await createProject(testDb(), { name: payload.slice(0, 120) });

    expect((await getEntry(testDb(), project.id, entry.ok ? entry.value.id : ''))?.description).toBe(payload.trim());
    expect((await getIssue(testDb(), project.id, issue.ok ? issue.value.id : '', d('2026-11-10')))?.title).toBe(payload.slice(0, 200).trim());
    expect((await getNote(testDb(), project.id, note.ok ? note.value.id : ''))?.body).toBe(payload.trim());
    expect((await getProject(testDb(), created.ok ? created.value.id : ''))?.name).toBe(payload.slice(0, 120).trim());
  });

  it('removes NUL characters, which Postgres cannot store, instead of failing', async () => {
    const project = await aProject(testDb());
    const person = await aPerson(testDb());

    const entry = await createEntry(prDeps(testDb()), project.id, { workDate: '2026-11-10', description: 'a\u0000b', personIds: [person.id] });
    const note = await createNote(testDb(), project.id, { title: 'x\u0000', body: '\u0000' });

    expect((await getEntry(testDb(), project.id, entry.ok ? entry.value.id : ''))?.description).toBe('ab');
    expect((await getNote(testDb(), project.id, note.ok ? note.value.id : ''))?.title).toBe('x');
  });

  it('a value made only of NUL characters counts as empty', async () => {
    const project = await aProject(testDb());

    expect(await createNote(testDb(), project.id, { title: '\u0000\u0000' })).toEqual({
      ok: false,
      error: { code: 'invalid', fieldErrors: { title: 'Title is required.' } },
    });
  });
});
