import { describe, expect, it } from 'vitest';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import { testDb } from '#tests/setup/test-db.ts';
import { aPerson, aPlan, aPlanItem, aProject, aPullRequest, anArea, anEntry, anIssue, withPeople } from '#tests/fixtures/builders.ts';
import { createIssue, deleteIssue, getIssue, listIssues, resolveIssue, setIssueStatus, updateIssue } from './issues.ts';

const today = d('2026-11-10');

async function base() {
  const project = await aProject(testDb());
  const grace = await aPerson(testDb(), { name: 'Grace' });
  return { project, grace };
}

const valid = (personId: string) => ({
  title: 'Crash on save',
  externalUrl: 'https://jira.example.com/browse/APP-12',
  personIds: [personId],
  assignedOn: '2026-11-09',
  deadline: '2026-11-16',
});

describe('issues', () => {
  it('BR-27: creates an issue as a reminder with link, area, assignees and dates', async () => {
    const { project, grace } = await base();
    const area = await anArea(testDb(), project.id, { name: 'Mobile' });

    const created = await createIssue(testDb(), project.id, { ...valid(grace.id), areaId: area.id });

    const issue = await getIssue(testDb(), project.id, created.ok ? created.value.id : '', today);
    expect(issue).toEqual({
      id: expect.any(String),
      title: 'Crash on save',
      externalUrl: 'https://jira.example.com/browse/APP-12',
      status: 'open',
      assignedOn: '2026-11-09',
      deadline: '2026-11-16',
      resolvedOn: null,
      area: { id: area.id, name: 'Mobile' },
      resolvedBy: null,
      assignees: [{ id: grace.id, name: 'Grace' }],
      deadlineState: { state: 'on_track', label: 'Due in 6 days' },
    });
  });

  it('BR-27: requires a title, an assignee and both dates', async () => {
    const { project } = await base();

    const result = await createIssue(testDb(), project.id, { title: ' ' });

    expect(result.ok || Object.keys(result.error.code === 'invalid' ? result.error.fieldErrors : {}).sort()).toEqual([
      'assignedOn',
      'deadline',
      'personIds',
      'title',
    ]);
  });

  it('BR-28: the deadline must be on or after the assigned date', async () => {
    const { project, grace } = await base();

    const before = await createIssue(testDb(), project.id, { ...valid(grace.id), deadline: '2026-11-08' });
    const same = await createIssue(testDb(), project.id, { ...valid(grace.id), deadline: '2026-11-09' });

    expect(before).toEqual({
      ok: false,
      error: { code: 'invalid', fieldErrors: { deadline: 'The deadline must be on or after the assigned date.' } },
    });
    expect(same.ok).toBe(true);
  });

  it('BR-34: the external link must be http(s)', async () => {
    const { project, grace } = await base();

    const result = await createIssue(testDb(), project.id, { ...valid(grace.id), externalUrl: 'javascript:alert(1)' });

    expect(result.ok || result.error).toEqual({ code: 'invalid', fieldErrors: { externalUrl: 'Link must start with https:// or http://' } });
  });

  it('edits an issue and refuses another project’s area', async () => {
    const { project, grace } = await base();
    const issue = await anIssue(testDb(), project.id);
    await withPeople(testDb(), 'issueAssignees', issue.id, [grace.id]);
    const foreignArea = await anArea(testDb(), (await aProject(testDb())).id);

    expect((await updateIssue(testDb(), project.id, issue.id, { ...valid(grace.id), title: 'Renamed' })).ok).toBe(true);
    expect((await getIssue(testDb(), project.id, issue.id, today))?.title).toBe('Renamed');
    expect((await updateIssue(testDb(), project.id, issue.id, { ...valid(grace.id), areaId: foreignArea.id })).ok).toBe(false);
    expect((await updateIssue(testDb(), project.id, issue.id, {})).ok).toBe(false);
    expect(await updateIssue(testDb(), project.id, 'bad', valid(grace.id))).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await updateIssue(testDb(), project.id, project.id, valid(grace.id))).toEqual({ ok: false, error: { code: 'not_found' } });
  });
});

describe('resolving', () => {
  it('BR-29: resolving records resolved_on, defaulting to today', async () => {
    const { project } = await base();
    const issue = await anIssue(testDb(), project.id, { deadline: '2026-11-13' });

    await resolveIssue(testDb(), project.id, issue.id, {}, today);

    expect(await getIssue(testDb(), project.id, issue.id, today)).toMatchObject({
      status: 'resolved',
      resolvedOn: '2026-11-10',
      deadlineState: { state: 'on_time', label: 'Resolved on time' },
    });
  });

  it('BR-29: the resolved date is editable, but not in the future', async () => {
    const { project } = await base();
    const issue = await anIssue(testDb(), project.id, { assignedOn: '2026-11-02', deadline: '2026-11-05' });

    const future = await resolveIssue(testDb(), project.id, issue.id, { resolvedOn: '2026-11-11' }, today);
    await resolveIssue(testDb(), project.id, issue.id, { resolvedOn: '2026-11-09' }, today);

    expect(future.ok).toBe(false);
    expect((await getIssue(testDb(), project.id, issue.id, today))?.deadlineState).toEqual({ state: 'late', label: 'Resolved 4 days late' });
  });

  it('BR-30: may record the PR that resolved it, from this project only', async () => {
    const { project } = await base();
    const issue = await anIssue(testDb(), project.id);
    const pr = await aPullRequest(testDb(), project.id, { number: 77 });
    const foreign = await aPullRequest(testDb(), (await aProject(testDb())).id);

    const refused = await resolveIssue(testDb(), project.id, issue.id, { resolvedByPrId: foreign.id }, today);
    await resolveIssue(testDb(), project.id, issue.id, { resolvedByPrId: pr.id }, today);

    expect(refused).toEqual({ ok: false, error: { code: 'invalid', fieldErrors: { resolvedByPrId: 'Choose a pull request of this project.' } } });
    expect((await getIssue(testDb(), project.id, issue.id, today))?.resolvedBy).toMatchObject({ number: 77 });
  });

  it('BR-29: reopening clears resolved_on and the resolving PR', async () => {
    const { project } = await base();
    const pr = await aPullRequest(testDb(), project.id);
    const issue = await anIssue(testDb(), project.id, { status: 'resolved', resolvedOn: '2026-11-09', resolvedByPrId: pr.id });

    await setIssueStatus(testDb(), project.id, issue.id, { status: 'open' });

    expect(await getIssue(testDb(), project.id, issue.id, today)).toMatchObject({ status: 'open', resolvedOn: null, resolvedBy: null });
  });

  it('BR-27: in_progress is a status; resolved can only be set by resolving', async () => {
    const { project } = await base();
    const issue = await anIssue(testDb(), project.id);

    expect((await setIssueStatus(testDb(), project.id, issue.id, { status: 'in_progress' })).ok).toBe(true);
    expect((await setIssueStatus(testDb(), project.id, issue.id, { status: 'resolved' })).ok).toBe(false);
  });

  it('handles unknown issues', async () => {
    const { project } = await base();
    const other = await anIssue(testDb(), (await aProject(testDb())).id);

    for (const issueId of ['bad', other.id]) {
      expect(await resolveIssue(testDb(), project.id, issueId, {}, today)).toEqual({ ok: false, error: { code: 'not_found' } });
      expect(await setIssueStatus(testDb(), project.id, issueId, { status: 'open' })).toEqual({ ok: false, error: { code: 'not_found' } });
      expect(await deleteIssue(testDb(), project.id, issueId)).toEqual({ ok: false, error: { code: 'not_found' } });
      expect(await getIssue(testDb(), project.id, issueId, today)).toBeNull();
    }
    expect((await resolveIssue(testDb(), project.id, other.id, { resolvedOn: 'x' }, today)).ok).toBe(false);
    expect((await setIssueStatus(testDb(), project.id, other.id, {})).ok).toBe(false);
  });
});

describe('listing and deleting', () => {
  it('BR-31: lists open issues by deadline first, then resolved, each with its state', async () => {
    const { project } = await base();
    await anIssue(testDb(), project.id, { title: 'resolved', status: 'resolved', resolvedOn: '2026-11-06', deadline: '2026-11-05', assignedOn: '2026-11-01' });
    await anIssue(testDb(), project.id, { title: 'later', deadline: '2026-11-20' });
    await anIssue(testDb(), project.id, { title: 'overdue', assignedOn: '2026-11-01', deadline: '2026-11-06' });
    await anIssue(testDb(), project.id, { title: 'soon', deadline: '2026-11-11' });

    const issues = await listIssues(testDb(), project.id, today);

    expect(issues.map((i) => [i.title, i.deadlineState.state])).toEqual([
      ['overdue', 'overdue'],
      ['soon', 'due_soon'],
      ['later', 'on_track'],
      ['resolved', 'late'],
    ]);
    expect((await listIssues(testDb(), project.id, today, { openOnly: true })).map((i) => i.title)).toEqual(['overdue', 'soon', 'later']);
  });

  it('BR-36: deleting an issue keeps entries and plan items that referred to it', async () => {
    const { project } = await base();
    const issue = await anIssue(testDb(), project.id);
    const entry = await anEntry(testDb(), project.id, { issueId: issue.id });
    const item = await aPlanItem(testDb(), await aPlan(testDb(), project.id), { issueId: issue.id });

    expect(await deleteIssue(testDb(), project.id, issue.id)).toEqual({ ok: true, value: null });

    expect(await testDb().selectFrom('entries').select('issueId').where('id', '=', entry.id).executeTakeFirst()).toEqual({ issueId: null });
    expect(await testDb().selectFrom('planItems').select('issueId').where('id', '=', item.id).executeTakeFirst()).toEqual({ issueId: null });
  });
});
