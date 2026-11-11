import { describe, expect, it } from 'vitest';
import { testDb } from '#tests/setup/test-db.ts';
import {
  aPerson, aPlan, aPlanItem, aProject, aPullRequest, aRelease, anArea, anEntry, anIssue,
} from '#tests/fixtures/builders.ts';

/* The database is the last line of defence: each rule below holds even if a service is wrong. */

async function twoProjects(): Promise<{ a: string; b: string }> {
  const a = await aProject(testDb());
  const b = await aProject(testDb());
  return { a: a.id, b: b.id };
}

describe('database constraints', () => {
  it('BR-05: project names, person names and area names within a project are unique', async () => {
    const project = await aProject(testDb(), { name: 'Atlas' });
    await anArea(testDb(), project.id, { name: 'Frontend' });
    await aPerson(testDb(), { name: 'Grace' });

    await expect(aProject(testDb(), { name: 'Atlas' })).rejects.toThrow(/unique/);
    await expect(anArea(testDb(), project.id, { name: 'Frontend' })).rejects.toThrow(/unique/);
    await expect(aPerson(testDb(), { name: 'Grace' })).rejects.toThrow(/unique/);
  });

  it('BR-05: the same area name is allowed in two different projects', async () => {
    const { a, b } = await twoProjects();
    await anArea(testDb(), a, { name: 'Backend' });

    await expect(anArea(testDb(), b, { name: 'Backend' })).resolves.toMatchObject({ name: 'Backend' });
  });

  it('rejects a slug that is not kebab-case', async () => {
    await expect(aProject(testDb(), { slug: 'Not A Slug' })).rejects.toThrow(/check/);
  });

  it('BR-08: a week plan must start on a Monday and a month plan on the 1st', async () => {
    const project = await aProject(testDb());

    await expect(aPlan(testDb(), project.id, { horizon: 'week', periodStart: '2026-11-10' })).rejects.toThrow(/check/);
    await expect(aPlan(testDb(), project.id, { horizon: 'month', periodStart: '2026-11-02' })).rejects.toThrow(/check/);
    await expect(aPlan(testDb(), project.id, { horizon: 'day', periodStart: '2026-11-14' })).rejects.toThrow(/check/);
  });

  it('BR-09: at most one plan per project, horizon and period', async () => {
    const project = await aProject(testDb());
    await aPlan(testDb(), project.id, { horizon: 'day', periodStart: '2026-11-10' });

    await expect(aPlan(testDb(), project.id, { horizon: 'day', periodStart: '2026-11-10' })).rejects.toThrow(/unique/);
  });

  it('BR-16: a done plan item must have completed_on, and only a done one', async () => {
    const project = await aProject(testDb());
    const plan = await aPlan(testDb(), project.id);

    await expect(aPlanItem(testDb(), plan, { status: 'done' })).rejects.toThrow(/check/);
    await expect(aPlanItem(testDb(), plan, { status: 'planned', completedOn: '2026-11-10' })).rejects.toThrow(/check/);
  });

  it('BR-28: an issue deadline cannot be before its assigned date', async () => {
    const project = await aProject(testDb());

    await expect(anIssue(testDb(), project.id, { assignedOn: '2026-11-10', deadline: '2026-11-09' })).rejects.toThrow(/check/);
  });

  it('BR-29: resolved_on is set exactly when an issue is resolved', async () => {
    const project = await aProject(testDb());

    await expect(anIssue(testDb(), project.id, { status: 'resolved' })).rejects.toThrow(/check/);
    await expect(anIssue(testDb(), project.id, { resolvedOn: '2026-11-10' })).rejects.toThrow(/check/);
  });

  it('BR-32: a released release needs a released date, and versions are unique per project', async () => {
    const project = await aProject(testDb());
    await aRelease(testDb(), project.id, { version: '1.0.0' });

    await expect(aRelease(testDb(), project.id, { status: 'released' })).rejects.toThrow(/check/);
    await expect(aRelease(testDb(), project.id, { version: '1.0.0' })).rejects.toThrow(/unique/);
  });

  it('BR-34: external links must be http(s)', async () => {
    const project = await aProject(testDb());

    await expect(anIssue(testDb(), project.id, { externalUrl: 'javascript:alert(1)' })).rejects.toThrow(/check/);
  });

  it('BR-19: an entry cannot point at another project’s PR, area, plan item or issue', async () => {
    const { a, b } = await twoProjects();
    const foreignPr = await aPullRequest(testDb(), b);
    const foreignArea = await anArea(testDb(), b);
    const foreignIssue = await anIssue(testDb(), b);
    const foreignItem = await aPlanItem(testDb(), await aPlan(testDb(), b));

    await expect(anEntry(testDb(), a, { pullRequestId: foreignPr.id })).rejects.toThrow(/foreign key/);
    await expect(anEntry(testDb(), a, { areaId: foreignArea.id })).rejects.toThrow(/foreign key/);
    await expect(anEntry(testDb(), a, { issueId: foreignIssue.id })).rejects.toThrow(/foreign key/);
    await expect(anEntry(testDb(), a, { planItemId: foreignItem.id })).rejects.toThrow(/foreign key/);
  });

  it('BR-17, BR-19: an entry may link several issues, but never another project’s, enforced by the database', async () => {
    const { a, b } = await twoProjects();
    const mine = [await anIssue(testDb(), a), await anIssue(testDb(), a)];
    const foreign = await anIssue(testDb(), b);

    await expect(anEntry(testDb(), a, { issueIds: mine.map((issue) => issue.id) })).resolves.toBeDefined();
    await expect(anEntry(testDb(), a, { issueIds: [mine[0]?.id ?? '', foreign.id] })).rejects.toThrow(/foreign key/);
  });

  it('BR-36: a PR referenced by an entry cannot be deleted', async () => {
    const project = await aProject(testDb());
    const pr = await aPullRequest(testDb(), project.id);
    await anEntry(testDb(), project.id, { pullRequestId: pr.id });

    await expect(testDb().deleteFrom('pullRequests').where('id', '=', pr.id).execute()).rejects.toThrow(/foreign key/);
  });

  it('BR-36: deleting a plan item or issue keeps the entry and clears only that link', async () => {
    const project = await aProject(testDb());
    const issue = await anIssue(testDb(), project.id);
    const item = await aPlanItem(testDb(), await aPlan(testDb(), project.id));
    const entry = await anEntry(testDb(), project.id, { issueId: issue.id, planItemId: item.id });

    await testDb().deleteFrom('issues').where('id', '=', issue.id).execute();
    await testDb().deleteFrom('planItems').where('id', '=', item.id).execute();

    const row = await testDb().selectFrom('entries').selectAll().where('id', '=', entry.id).executeTakeFirstOrThrow();
    expect(row).toMatchObject({ projectId: project.id });
    expect(await testDb().selectFrom('entryIssues').selectAll().execute()).toEqual([]);
    expect(await testDb().selectFrom('entryPlanItems').selectAll().execute()).toEqual([]);
  });
});
