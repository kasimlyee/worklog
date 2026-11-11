import { describe, expect, it } from 'vitest';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import { areas, entry, issue, person, planItem, pr, release, reportData } from '#tests/fixtures/report-data.ts';
import { buildReportModel } from './build.ts';
import type { ReportModel, ReportSection } from './model.ts';

const today = d('2026-11-20');

function sectionOf(model: ReportModel, title: string): ReportSection {
  const found = model.sections.find((s) => s.title === title);
  if (found === undefined) {
    throw new Error(`No section "${title}" in ${model.sections.map((s) => s.title).join(', ')}`);
  }
  return found;
}

const texts = (s: ReportSection): readonly (readonly [string | null, readonly string[]])[] =>
  s.groups.map((g) => [g.title, g.lines.map((l) => l.text)] as const);

describe('report header', () => {
  it('R-01: one project and one period', () => {
    const model = buildReportModel(reportData({ kind: 'weekly' }), today);

    expect([model.projectName, model.kind, model.periodStart]).toEqual(['Atlas', 'weekly', '2026-11-09']);
  });

  it('R-03: project, type, period, author and generated date', () => {
    const header = (kind: 'daily' | 'weekly' | 'monthly') => {
      const m = buildReportModel(reportData({ kind }), today);
      return [m.typeLabel, m.periodLabel, m.author, m.generatedLabel];
    };

    expect(header('daily')).toEqual(['Daily report', 'Tuesday 10 Nov 2026', 'Kasim', '20 Nov 2026']);
    expect(header('weekly')).toEqual(['Weekly report', 'Week of 9–13 Nov 2026', 'Kasim', '20 Nov 2026']);
    expect(header('monthly')).toEqual(['Monthly report', 'November 2026', 'Kasim', '20 Nov 2026']);
  });

  it('R-04: carries the report note, or none when blank', () => {
    expect(buildReportModel(reportData({ kind: 'daily', note: '  Short day.  ' }), today).note).toBe('Short day.');
    expect(buildReportModel(reportData({ kind: 'daily', note: '   ' }), today).note).toBeNull();
  });
});

describe('work done', () => {
  it('R-05: areas in the project order, entries without an area last under General', () => {
    const data = reportData({
      kind: 'daily',
      entries: [entry('general work', { area: null }), entry('api', { area: areas.backend }), entry('ui', { area: areas.frontend })],
    });

    expect(texts(sectionOf(buildReportModel(data, today), 'Work done')).map(([title]) => title)).toEqual(['Frontend', 'Backend', 'General']);
  });

  it('R-06: PR groups first by number, then entries without a PR in date order', () => {
    const data = reportData({
      kind: 'weekly',
      entries: [
        entry('loose Tue', { date: '2026-11-10', area: areas.backend }),
        entry('pr 9 work', { pr: pr(9), area: areas.backend }),
        entry('loose Mon', { date: '2026-11-09', area: areas.backend }),
        entry('pr 3 work', { pr: pr(3), area: areas.backend }),
      ].sort((a, b) => a.workDate.localeCompare(b.workDate)),
    });

    expect(texts(sectionOf(buildReportModel(data, today), 'Work done'))).toEqual([['Backend', ['#3 PR 3', '#9 PR 9', 'loose Mon', 'loose Tue']]]);
  });

  it('R-07: PR groups show #number title with the PR state', () => {
    const data = reportData({ kind: 'daily', entries: [entry('x', { pr: pr(12, 'merged', 'Fix login') })] });

    const [prLine] = sectionOf(buildReportModel(data, today), 'Work done').groups[0]?.lines ?? [];

    expect(prLine?.text).toBe('#12 Fix login');
    expect(prLine?.tags).toEqual([{ tone: 'success', label: 'Merged' }]);
  });

  it('R-10: a closed, unmerged PR is red; an open one neutral — always with a text label', () => {
    const data = reportData({ kind: 'daily', entries: [entry('a', { pr: pr(1, 'closed') }), entry('b', { pr: pr(2, 'open') })] });

    const tags = sectionOf(buildReportModel(data, today), 'Work done').groups[0]?.lines.flatMap((l) => l.tags);

    expect(tags).toEqual([{ tone: 'danger', label: 'Closed' }, { tone: 'neutral', label: 'Open' }]);
  });

  it('R-09: people are shown by name after each entry', () => {
    const data = reportData({ kind: 'daily', entries: [entry('x', { people: [person('Ali'), person('Grace')] })] });

    expect(sectionOf(buildReportModel(data, today), 'Work done').groups[0]?.lines[0]?.people).toEqual(['Ali', 'Grace']);
  });

  it('daily: every entry appears under its PR', () => {
    const data = reportData({ kind: 'daily', entries: [entry('first', { pr: pr(4) }), entry('second', { pr: pr(4) })] });

    const [prLine] = sectionOf(buildReportModel(data, today), 'Work done').groups[0]?.lines ?? [];

    expect(prLine?.children.map((c) => c.text)).toEqual(['first', 'second']);
  });

  it('weekly: one line per PR with its entry count and everyone who worked on it', () => {
    const data = reportData({
      kind: 'weekly',
      entries: [entry('a', { pr: pr(4), people: [person('Grace')] }), entry('b', { pr: pr(4), people: [person('Ali')] }), entry('c', { pr: pr(5) })],
    });

    const lines = sectionOf(buildReportModel(data, today), 'Work done').groups[0]?.lines;

    expect(lines?.map((l) => [l.text, l.detail, l.people, l.children.length])).toEqual([
      ['#4 PR 4', '2 entries', ['Ali', 'Grace'], 0],
      ['#5 PR 5', '1 entry', ['Grace'], 0],
    ]);
  });

  it('BR-18: weekly includes Saturday and Sunday entries, labelled as weekend work', () => {
    const data = reportData({ kind: 'weekly', entries: [entry('hotfix', { date: '2026-11-14' }), entry('normal', { date: '2026-11-13' })] });

    const lines = sectionOf(buildReportModel(data, today), 'Work done').groups[0]?.lines;

    expect(lines?.map((l) => l.detail)).toEqual(['Sat 14 Nov · weekend work', 'Fri 13 Nov']);
  });
});

describe('empty content', () => {
  it('R-08: sections with no content are omitted', () => {
    const data = reportData({ kind: 'weekly', entries: [entry('only work')] });

    expect(buildReportModel(data, today).sections.map((s) => s.title)).toEqual(['Summary', 'Work done', 'Per developer', 'Plan vs. actual']);
  });

  it('R-08: a report with no content at all has no sections', () => {
    for (const kind of ['daily', 'weekly', 'monthly'] as const) {
      expect(buildReportModel(reportData({ kind }), today).sections).toEqual([]);
    }
  });
});

describe('daily sections', () => {
  it('§7.2: releases released that day with their PRs', () => {
    const data = reportData({ kind: 'daily', releases: [release('1.2.0', '2026-11-10', [pr(7, 'merged')])] });

    const [releaseLine] = sectionOf(buildReportModel(data, today), 'Releases').groups[0]?.lines ?? [];

    expect(releaseLine).toMatchObject({ text: '1.2.0', tags: [{ tone: 'success', label: 'Released' }], detail: '10 Nov 2026' });
    expect(releaseLine?.children.map((c) => c.text)).toEqual(['#7 PR 7']);
  });

  it('BR-31: issues resolved that day show on time or late; those that became overdue that day show red', () => {
    const data = reportData({
      kind: 'daily',
      issues: [
        issue('on time', '2026-11-12', '2026-11-10'),
        issue('late', '2026-11-06', '2026-11-10'),
        issue('became overdue', '2026-11-09'),
        issue('long overdue', '2026-11-02'),
      ],
    });

    const issues = sectionOf(buildReportModel(data, today), 'Issues');

    expect(issues.groups.map((g) => [g.title, g.lines.map((l) => [l.text, l.tags[0]?.tone, l.tags[0]?.label])])).toEqual([
      ['Resolved', [['on time', 'success', 'Resolved on time'], ['late', 'danger', 'Resolved 4 days late']]],
      ['Became overdue', [['became overdue', 'danger', '1 day overdue']]],
    ]);
  });

  it('§7.2: plan vs actual — done, not done in red, and unplanned work', () => {
    const data = reportData({
      kind: 'daily',
      planItems: [planItem('shipped', { completedOn: '2026-11-10' }), planItem('slipped'), planItem('done later', { completedOn: '2026-11-12' })],
      entries: [entry('planned work', { planItemId: 'x' }), entry('unplanned work')],
    });

    const plan = sectionOf(buildReportModel(data, today), 'Plan vs. actual');

    expect(plan.groups.map((g) => [g.title, g.lines.map((l) => [l.text, l.tags[0]?.label ?? null])])).toEqual([
      ['Done', [['shipped', 'Done']]],
      ['Not done', [['slipped', 'Not done'], ['done later', 'Not done']]],
      ['Unplanned work', [['unplanned work', null]]],
    ]);
    expect(plan.groups[1]?.lines[0]?.tags[0]?.tone).toBe('danger');
  });
});

describe('weekly sections', () => {
  it('§7.3: summary counts entries, PRs touched and merged, releases and issues resolved', () => {
    const data = reportData({
      kind: 'weekly',
      entries: [entry('a', { pr: pr(1, 'merged') }), entry('b', { pr: pr(1, 'merged') }), entry('c', { pr: pr(2) }), entry('d')],
      releases: [release('1.0', '2026-11-12')],
      issues: [issue('fixed', '2026-11-13', '2026-11-11'), issue('still open', '2026-11-30')],
    });

    expect(sectionOf(buildReportModel(data, today), 'Summary').summary).toEqual([
      { label: 'Entries', value: 4 },
      { label: 'PRs touched', value: 2 },
      { label: 'PRs merged', value: 1 },
      { label: 'Releases', value: 1 },
      { label: 'Issues resolved', value: 1 },
    ]);
  });

  it('§7.3: issues resolved and still open and overdue at the end of the week', () => {
    const data = reportData({
      kind: 'weekly',
      asOf: d('2026-11-15'),
      issues: [issue('resolved', '2026-11-13', '2026-11-12'), issue('overdue', '2026-11-11'), issue('resolved after week', '2026-11-10', '2026-11-18')],
    });

    expect(texts(sectionOf(buildReportModel(data, today), 'Issues'))).toEqual([
      ['Resolved', ['resolved']],
      ['Still open and overdue', ['overdue', 'resolved after week']],
    ]);
  });

  it('§7.3: per developer — entries, issues on time vs late, open overdue items', () => {
    const grace = person('Grace');
    const ali = person('Ali');
    const data = reportData({
      kind: 'weekly',
      entries: [entry('a', { people: [grace] }), entry('b', { people: [grace, ali] })],
      issues: [issue('on time', '2026-11-13', '2026-11-12', [grace]), issue('late', '2026-11-09', '2026-11-12', [grace]), issue('overdue', '2026-11-10', null, [ali])],
      overdueItems: [planItem('slipped', { assignees: [ali] })],
    });

    const devs = sectionOf(buildReportModel(data, today), 'Per developer');

    expect(devs.groups.map((g) => [g.title, g.lines.map((l) => [l.text, l.tags.map((t) => t.label)])])).toEqual([
      ['Ali', [['Entries: 1', []], ['Open overdue items: 2', ['Overdue']]]],
      ['Grace', [['Entries: 2', []], ['Issues resolved: 2', ['1 on time', '1 late']]]],
    ]);
  });

  it('§7.3: plan vs actual counts carried-over items', () => {
    const data = reportData({
      kind: 'weekly',
      planItems: [planItem('week goal', { horizon: 'week', due: '2026-11-13' })],
      moves: [
        { title: 'moved twice', fromDue: d('2026-11-09'), toDue: d('2026-11-10') },
        { title: 'moved twice', fromDue: d('2026-11-10'), toDue: d('2026-11-16') },
      ],
    });

    const plan = sectionOf(buildReportModel(data, today), 'Plan vs. actual');

    expect(plan.groups.map((g) => g.title)).toEqual(['Not done', 'Carried over (2)']);
    expect(plan.groups[1]?.lines[1]?.detail).toBe('Moved from Tue 10 Nov to Mon 16 Nov');
    expect(plan.summary.find((s) => s.label === 'Carried over')?.value).toBe(2);
  });
});

describe('monthly sections', () => {
  it('§7.4: merged PRs per area, title and number only', () => {
    const data = reportData({
      kind: 'monthly',
      entries: [
        entry('a', { area: areas.backend, pr: pr(8, 'merged', 'API v2') }),
        entry('b', { area: areas.backend, pr: pr(8, 'merged', 'API v2') }),
        entry('c', { area: areas.frontend, pr: pr(9, 'open') }),
      ],
    });

    const merged = sectionOf(buildReportModel(data, today), 'Merged pull requests');

    expect(merged.groups.map((g) => [g.title, g.lines.map((l) => [l.text, l.tags])])).toEqual([['Backend', [['#8 API v2', []]]]]);
  });

  it('§7.4: completed plan items from week and month plans', () => {
    const data = reportData({ kind: 'monthly', completedItems: [planItem('Launch', { horizon: 'month', completedOn: '2026-11-25' })] });

    const [done] = sectionOf(buildReportModel(data, today), 'Completed plan items').groups[0]?.lines ?? [];

    expect(done).toMatchObject({ text: 'Launch', detail: 'Completed Wed 25 Nov', people: ['Ali'] });
  });

  it('§7.4: plan vs actual for the month counts unplanned work instead of listing it', () => {
    const data = reportData({ kind: 'monthly', planItems: [planItem('m', { horizon: 'month' })], entries: [entry('x'), entry('y')] });

    const plan = sectionOf(buildReportModel(data, today), 'Plan vs. actual');

    expect(plan.groups.map((g) => g.title)).toEqual(['Not done']);
    expect(plan.summary.find((s) => s.label === 'Unplanned entries')?.value).toBe(2);
  });

  it('§7.4: the month section order follows the spec', () => {
    const data = reportData({
      kind: 'monthly',
      entries: [entry('x', { pr: pr(1, 'merged') })],
      releases: [release('2.0', '2026-11-20')],
      completedItems: [planItem('c', { completedOn: '2026-11-03', horizon: 'week' })],
      issues: [issue('i', '2026-11-05', '2026-11-04')],
      planItems: [planItem('p', { horizon: 'month' })],
    });

    expect(buildReportModel(data, today).sections.map((s) => s.title)).toEqual([
      'Summary', 'Releases', 'Merged pull requests', 'Completed plan items', 'Issues', 'Per developer', 'Plan vs. actual',
    ]);
  });
});
