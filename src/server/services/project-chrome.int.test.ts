import { describe, expect, it } from 'vitest';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import { countQueries, testDb } from '#tests/setup/test-db.ts';
import { aPerson, aPlan, aPlanItem, aProject, aPullRequest, aRelease, anArea, anIssue } from '#tests/fixtures/builders.ts';
import { setAreaArchived, setPersonArchived } from './projects.ts';
import { loadProjectChrome } from './project-chrome.ts';

const tuesday = d('2026-11-10');

describe('project chrome', () => {
  it('NF-01: loads every form option list and the overdue count in one query', async () => {
    const project = await aProject(testDb());
    await anArea(testDb(), project.id);
    await anIssue(testDb(), project.id);

    expect(await countQueries(() => loadProjectChrome(testDb(), project.id, tuesday))).toBe(1);
  });

  it('BR-06, BR-13: leaves out archived areas and people, done items and resolved issues; counts what is overdue', async () => {
    const project = await aProject(testDb());
    const web = await anArea(testDb(), project.id, { name: 'Web', position: 0 });
    const old = await anArea(testDb(), project.id, { name: 'Old', position: 1 });
    await setAreaArchived(testDb(), project.id, old.id, true);
    await aPerson(testDb(), { name: 'Grace' });
    const gone = await aPerson(testDb(), { name: 'Gone' });
    await setPersonArchived(testDb(), gone.id, true);
    const plan = await aPlan(testDb(), project.id, { horizon: 'month', periodStart: '2026-11-01' });
    await aPlanItem(testDb(), plan, { title: 'late item', dueDate: '2026-11-02' });
    await aPlanItem(testDb(), plan, { title: 'done item', status: 'done', completedOn: '2026-11-02' });
    await anIssue(testDb(), project.id, { title: 'late issue', assignedOn: '2026-11-01', deadline: '2026-11-03' });
    await anIssue(testDb(), project.id, { title: 'fixed', status: 'resolved', resolvedOn: '2026-11-02' });
    await aPullRequest(testDb(), project.id, { repo: 'app', number: 4, title: 'Add login' });
    await aRelease(testDb(), project.id, { version: '1.0' });
    await anIssue(testDb(), (await aProject(testDb())).id, { title: 'other project' });

    const { options, overdueCount } = await loadProjectChrome(testDb(), project.id, tuesday);

    expect(options.areas).toEqual([{ id: web.id, name: 'Web' }]);
    expect(options.people.map((p) => p.name)).toEqual(['Grace']);
    expect(options.planItems.map((i) => [i.title, i.dueDate])).toEqual([['late item', '2026-11-02']]);
    expect(options.issues.map((i) => i.title)).toEqual(['late issue']);
    expect(options.pullRequests).toMatchObject([{ repo: 'app', number: 4, title: 'Add login' }]);
    expect(options.releases.map((r) => r.version)).toEqual(['1.0']);
    expect(overdueCount).toBe(2);
  });
});
