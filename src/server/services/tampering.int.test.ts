import { describe, expect, it } from 'vitest';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import type { Db } from '#src/server/db/client.ts';
import { testDb } from '#tests/setup/test-db.ts';
import { fakeGitHub, prDeps } from '#tests/fixtures/github.ts';
import {
  aPerson, aPlan, aPlanItem, aProject, aPullRequest, aRelease, anArea, anEntry, anIssue,
} from '#tests/fixtures/builders.ts';
import { deleteEntry, updateEntry } from './entries.ts';
import { deleteIssue, resolveIssue, setIssueStatus, updateIssue } from './issues.ts';
import { createNote, deleteNote, updateNote } from './notes.ts';
import { deletePlanItem, movePlanItem, setPlanItemStatus, updatePlanItem } from './plans.ts';
import { renameArea, setAreaArchived } from './projects.ts';
import { deletePullRequest, refreshPullRequest } from './pull-requests.ts';
import { deleteRelease, updateRelease } from './releases.ts';
import type { ServiceResult } from './errors.ts';

/* docs/04 §4.3: every mutation given an id from another project is refused and changes nothing. */

async function snapshot(db: Db, projectId: string): Promise<string> {
  const tables = ['areas', 'entries', 'issues', 'planItems', 'releases', 'notes', 'pullRequests'] as const;
  const rows = await Promise.all(tables.map((table) => db.selectFrom(table).selectAll().where('projectId', '=', projectId).orderBy('id').execute()));
  return JSON.stringify(rows);
}

describe('cross-project tampering', () => {
  it('every mutation with another project’s id is refused, and that project is unchanged', async () => {
    const db = testDb();
    const mine = await aProject(db);
    const theirs = await aProject(db);
    const person = await aPerson(db);
    const area = await anArea(db, theirs.id);
    const entry = await anEntry(db, theirs.id);
    const issue = await anIssue(db, theirs.id);
    const item = await aPlanItem(db, await aPlan(db, theirs.id, { horizon: 'month', periodStart: '2026-11-01' }));
    const release = await aRelease(db, theirs.id);
    const pr = await aPullRequest(db, theirs.id);
    const note = await createNote(db, theirs.id, { title: 'Theirs' });
    const noteId = note.ok ? note.value.id : '';
    const before = await snapshot(db, theirs.id);
    const today = d('2026-11-10');
    const deps = prDeps(db, fakeGitHub());

    const attempts: readonly (readonly [string, () => Promise<ServiceResult<unknown>>])[] = [
      ['updateEntry', () => updateEntry(deps, mine.id, entry.id, { workDate: '2026-11-10', description: 'x', personIds: [person.id] })],
      ['deleteEntry', () => deleteEntry(db, mine.id, entry.id)],
      ['updatePlanItem', () => updatePlanItem(db, mine.id, item.id, { title: 'x' })],
      ['setPlanItemStatus', () => setPlanItemStatus(db, mine.id, item.id, { status: 'done' }, today)],
      ['movePlanItem', () => movePlanItem(db, mine.id, item.id, { dueDate: '2026-11-20' })],
      ['deletePlanItem', () => deletePlanItem(db, mine.id, item.id)],
      ['updateIssue', () => updateIssue(db, mine.id, issue.id, { title: 'x', personIds: [person.id], assignedOn: '2026-11-01', deadline: '2026-11-02' })],
      ['resolveIssue', () => resolveIssue(db, mine.id, issue.id, {}, today)],
      ['setIssueStatus', () => setIssueStatus(db, mine.id, issue.id, { status: 'in_progress' })],
      ['deleteIssue', () => deleteIssue(db, mine.id, issue.id)],
      ['updateRelease', () => updateRelease(db, mine.id, release.id, { version: 'x', status: 'planned' })],
      ['deleteRelease', () => deleteRelease(db, mine.id, release.id)],
      ['updateNote', () => updateNote(db, mine.id, noteId, { title: 'x' })],
      ['deleteNote', () => deleteNote(db, mine.id, noteId)],
      ['renameArea', () => renameArea(db, mine.id, area.id, { name: 'x' })],
      ['setAreaArchived', () => setAreaArchived(db, mine.id, area.id, true)],
      ['refreshPullRequest', () => refreshPullRequest(deps, mine.id, pr.id)],
      ['deletePullRequest', () => deletePullRequest(db, mine.id, pr.id)],
    ];

    for (const [name, attempt] of attempts) {
      const result = await attempt();
      expect(result.ok, name).toBe(false);
    }
    expect(await snapshot(db, theirs.id)).toBe(before);
  });
});
