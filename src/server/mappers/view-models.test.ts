import { describe, expect, it } from 'vitest';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import type { Entry } from '#src/server/services/entries.ts';
import type { Issue } from '#src/server/services/issues.ts';
import type { Note } from '#src/server/services/notes.ts';
import type { PlanItem } from '#src/server/services/plans.ts';
import type { PullRequest } from '#src/server/services/pull-requests.ts';
import type { Release } from '#src/server/services/releases.ts';
import { deadlineTag } from './status.ts';
import {
  timestampLabel, toDashboardVM, toEntryFormValues, toEntryVM, toIssueDetailVM, toLogDays, toNoteFormValues, toNoteVM, toPickers,
  arrangeIssues, toIssueHistoryVM, toPlanItemDetailVM, toPlansVM, toPullRequestRowVM, toReleaseDetailVM,
} from './view-models.ts';
import { issuePriorityTag } from './status.ts';

const pr: PullRequest = { id: 'pr1', owner: 'acme', repo: 'app', number: 12, title: 'Add login', state: 'merged', url: 'https://github.com/acme/app/pull/12' };
const grace = { id: 'p1', name: 'Grace' };

const entry = (overrides: Partial<Entry> = {}): Entry => ({
  id: 'e1',
  workDate: d('2026-11-14'),
  description: 'Hotfix',
  area: { id: 'a1', name: 'Backend' },
  people: [grace],
  pullRequest: pr,
  planItem: { id: 'i1', title: 'Ship login' },
  issue: null,
  ...overrides,
});

const planItem: PlanItem = {
  id: 'i1',
  horizon: 'week',
  title: 'Ship login',
  status: 'blocked',
  dueDate: d('2026-11-06'),
  completedOn: null,
  area: null,
  issue: { id: 's1', title: 'Crash' },
  assignees: [grace],
  moves: [{ fromDue: d('2026-11-04'), toDue: d('2026-11-06'), movedAt: '2026-11-04T22:30:00+00:00' }],
  deadline: { state: 'overdue', label: '2 days overdue' },
};

const issue: Issue = {
  id: 's1',
  title: 'Crash',
  description: '',
  externalUrl: null,
  status: 'resolved',
  priority: 'high',
  assignedOn: d('2026-11-02'),
  deadline: d('2026-11-05'),
  resolvedOn: d('2026-11-06'),
  area: null,
  resolvedBy: pr,
  assignees: [grace],
  deadlineState: { state: 'late', label: 'Resolved 1 day late' },
};

describe('status colours', () => {
  it.each([
    ['overdue', 'danger'],
    ['due_soon', 'warning'],
    ['on_track', 'neutral'],
    ['on_time', 'success'],
    ['late', 'danger'],
  ] as const)('BR-31: %s is %s', (state, tone) => {
    expect(deadlineTag({ state, label: 'x' })).toEqual({ tone, label: 'x' });
  });
});

describe('view-model mappers', () => {
  it('BR-18: maps an entry, flagging weekend work', () => {
    expect(toEntryVM(entry())).toEqual({
      id: 'e1',
      date: '2026-11-14',
      dateLabel: 'Sat 14 Nov',
      isWeekend: true,
      description: 'Hotfix',
      area: 'Backend',
      people: ['Grace'],
      pullRequest: { id: 'pr1', number: 12, repo: 'app', title: 'Add login', url: pr.url, state: { tone: 'success', label: 'Merged' } },
      planItem: 'Ship login',
      planItemId: 'i1',
      issue: null,
      issueId: null,
    });
  });

  it('prefills the entry form with ids and the PR link', () => {
    expect(toEntryFormValues(entry({ area: null, pullRequest: null, planItem: null, issue: { id: 's1', title: 'x' } }))).toEqual({
      workDate: '2026-11-14',
      description: 'Hotfix',
      areaId: '',
      personIds: ['p1'],
      prUrl: '',
      planItemId: '',
      issueId: 's1',
    });
  });

  it('groups a newest-first page into days', () => {
    const days = toLogDays({
      entries: [entry({ id: 'a', workDate: d('2026-11-14') }), entry({ id: 'b', workDate: d('2026-11-14') }), entry({ id: 'c', workDate: d('2026-11-13') })],
      nextCursor: null,
    });

    expect(days.map((day) => [day.label, day.isWeekend, day.entries.map((e) => e.id)])).toEqual([
      ['Saturday 14 Nov 2026', true, ['a', 'b']],
      ['Friday 13 Nov 2026', false, ['c']],
    ]);
  });

  it('BR-15: shows move dates, the move time in the app time zone, and the edit form', () => {
    const vm = toPlanItemDetailVM(planItem, 'Week of 2–6 Nov 2026', 'Africa/Kampala');

    expect(vm).toMatchObject({
      statusTag: { tone: 'danger', label: 'Blocked' },
      deadline: { tone: 'danger', label: '2 days overdue' },
      dueLabel: 'Due Fri 6 Nov',
      moves: [{ fromLabel: 'Wed 4 Nov', toLabel: 'Fri 6 Nov', whenLabel: '5 Nov 2026' }],
      form: { title: 'Ship login', areaId: '', issueId: 's1', personIds: ['p1'] },
    });
  });

  it('BR-31: maps an issue with its deadline state and resolving PR', () => {
    expect(toIssueDetailVM(issue)).toMatchObject({
      statusTag: { tone: 'success', label: 'Resolved' },
      deadline: { tone: 'danger', label: 'Resolved 1 day late' },
      resolvedOnLabel: '6 Nov 2026',
      resolvedBy: { number: 12 },
      form: { externalUrl: '', assignedOn: '2026-11-02', deadline: '2026-11-05' },
    });
  });

  it('maps the dashboard, including the weekend', () => {
    const vm = toDashboardVM(
      {
        urgent: [
          { kind: 'issue', due: issue.deadline, issue: { ...issue, deadlineState: { state: 'overdue', label: '1 day overdue' } } },
          { kind: 'plan_item', due: planItem.dueDate, item: planItem },
        ],
        dueSoon: [],
        todaysPlan: null,
        openIssues: [],
        recentEntries: [entry()],
      },
      d('2026-11-14'),
      'UTC',
    );

    expect(vm.todayLabel).toBe('Saturday 14 Nov 2026');
    expect(vm.urgent.map((u) => [u.kind, u.dueLabel, u.deadline.tone])).toEqual([
      ['issue', 'Deadline Thu 5 Nov', 'danger'],
      ['plan_item', 'Due Fri 6 Nov', 'danger'],
    ]);
    expect(vm.todaysPlan).toBeNull();
  });

  it('maps releases with notes only when there are some', () => {
    const release: Release = {
      id: 'r1', version: '1.0', status: 'released', targetDate: null, releasedOn: d('2026-11-12'), notes: '  ', notesHtml: '<p></p>', pullRequests: [pr],
    };

    expect(toReleaseDetailVM(release, [])).toMatchObject({
      status: { tone: 'success', label: 'Released' },
      releasedLabel: '12 Nov 2026',
      targetLabel: null,
      notesHtml: '',
      form: { targetDate: '', releasedOn: '2026-11-12', pullRequestIds: ['pr1'] },
    });
  });

  it('maps notes and their form values', () => {
    const note: Note = {
      id: 'n1', title: 'T', body: '# x', bodyHtml: '<h3>x</h3>', updatedAt: new Date('2026-11-09T22:00:00Z'), release: null, pullRequest: pr,
      links: [{ label: 'a', url: 'https://a.example' }],
    };

    expect(toNoteVM(note, 'Africa/Kampala')).toMatchObject({ bodyHtml: '<h3>x</h3>', updatedLabel: '10 Nov 2026', pullRequest: { number: 12 } });
    expect(toNoteFormValues(note)).toEqual({ title: 'T', body: '# x', releaseId: '', pullRequestId: 'pr1', links: note.links });
    expect(timestampLabel('2026-11-09T20:59:00Z', 'Africa/Kampala')).toBe('9 Nov 2026');
  });

  it('maps picker options to labelled choices', () => {
    const pickers = toPickers({
      areas: [{ id: 'a1', name: 'Web' }],
      people: [{ id: 'p1', name: 'Grace' }],
      planItems: [{ id: 'i1', title: 'Ship login', dueDate: d('2026-11-06') }],
      issues: [{ id: 's1', title: 'Crash' }],
      pullRequests: [{ id: 'pr1', repo: 'app', number: 12, title: 'Add login' }],
      releases: [],
    });

    expect(pickers).toEqual({
      areas: [{ value: 'a1', label: 'Web' }],
      people: [{ value: 'p1', label: 'Grace' }],
      planItems: [{ value: 'i1', label: 'Ship login (due Fri 6 Nov)' }],
      issues: [{ value: 's1', label: 'Crash' }],
      pullRequests: [{ value: 'pr1', label: 'app #12 Add login' }],
      releases: [],
    });
    expect(toPullRequestRowVM(pr).owner).toBe('acme');
  });
});

describe('plans screen', () => {
  it('BR-08: a week plan with navigation and a default due date of today', () => {
    const vm = toPlansVM(
      { horizon: 'week', period: { start: d('2026-11-09'), end: d('2026-11-13') }, label: 'Week of 9–13 Nov 2026', items: [planItem] },
      'week',
      d('2026-11-09'),
      d('2026-11-10'),
      'UTC',
    );

    expect(vm).toMatchObject({
      label: 'Week of 9–13 Nov 2026',
      periodEnd: '2026-11-13',
      previousQuery: 'horizon=week&date=2026-11-02',
      nextQuery: 'horizon=week&date=2026-11-16',
      currentQuery: 'horizon=week&date=2026-11-10',
      canAdd: true,
      defaultDueDate: '2026-11-10',
    });
    expect(vm.items).toHaveLength(1);
  });

  it('BR-03: a weekend day has no plan and cannot take items', () => {
    const vm = toPlansVM(null, 'day', d('2026-11-14'), d('2026-11-10'), 'UTC');

    expect(vm).toMatchObject({ label: 'Saturday 14 Nov 2026', canAdd: false, items: [], previousQuery: 'horizon=day&date=2026-11-13', defaultDueDate: '2026-11-14' });
  });
});

describe('issue priority', () => {
  const withPriority = (id: string, priority: Issue['priority']): Issue => ({ ...issue, id, priority });
  const list = [withPriority('a', 'low'), withPriority('b', 'urgent'), withPriority('c', 'medium'), withPriority('d', 'urgent'), withPriority('e', 'high')];

  it('BR-37: colours — urgent red, high yellow, medium and low neutral, always labelled', () => {
    expect(Object.values(issuePriorityTag).map((tag) => `${tag.tone}:${tag.label}`)).toEqual(['danger:Urgent', 'warning:High', 'neutral:Medium', 'neutral:Low']);
  });

  it('BR-37: filters by one priority', () => {
    expect(arrangeIssues(list, { priority: 'urgent', sortBy: 'deadline' }).map((i) => i.id)).toEqual(['b', 'd']);
  });

  it('BR-37: sorts urgent first, keeping the deadline order within a priority', () => {
    expect(arrangeIssues(list, { priority: null, sortBy: 'priority' }).map((i) => i.id)).toEqual(['b', 'd', 'e', 'c', 'a']);
    expect(arrangeIssues(list, { priority: null, sortBy: 'deadline' }).map((i) => i.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('BR-37: the dashboard shows the priority of high and urgent issues only', () => {
    const vm = toDashboardVM(
      {
        urgent: [{ kind: 'issue', due: issue.deadline, issue: { ...issue, priority: 'urgent' } }],
        dueSoon: [{ kind: 'issue', due: issue.deadline, issue: { ...issue, priority: 'medium' } }],
        todaysPlan: null,
        openIssues: [],
        recentEntries: [],
      },
      d('2026-11-10'),
      'UTC',
    );

    expect([vm.urgent[0]?.priority, vm.dueSoon[0]?.priority]).toEqual([{ tone: 'danger', label: 'Urgent' }, null]);
  });
});

describe('issue history', () => {
  const resolvedIssue: Issue = {
    ...issue,
    assignedOn: d('2026-11-02'),
    deadline: d('2026-11-05'),
    resolvedOn: d('2026-11-06'),
    resolvedBy: pr,
    deadlineState: { state: 'late', label: 'Resolved 1 day late' },
  };
  const doneItem: PlanItem = { ...planItem, id: 'i2', title: 'Fix it', status: 'done', dueDate: d('2026-11-05'), completedOn: d('2026-11-06'), deadline: null, moves: [] };

  it('BR-40: orders assignment, plan items, log entries and resolution by date', () => {
    const vm = toIssueHistoryVM(resolvedIssue, {
      planItems: [doneItem],
      entries: [entry({ id: 'e2', workDate: d('2026-11-06'), description: 'Shipped fix' }), entry({ id: 'e1', workDate: d('2026-11-03'), description: 'Found cause', pullRequest: null })],
    });

    expect(vm.events.map((e) => [e.dateLabel, e.kind, e.title])).toEqual([
      ['2 Nov 2026', 'assigned', 'Assigned'],
      ['3 Nov 2026', 'logged', 'Found cause'],
      ['6 Nov 2026', 'planned', 'Fix it'],
      ['6 Nov 2026', 'logged', 'Shipped fix'],
      ['6 Nov 2026', 'resolved', 'Resolved'],
    ]);
    expect(vm.events.find((e) => e.kind === 'planned')).toMatchObject({ detail: 'Planned for Thu 5 Nov, done Fri 6 Nov', planItemId: 'i2', tags: [{ label: 'Done' }] });
    expect(vm.events.find((e) => e.kind === 'resolved')).toMatchObject({ tags: [{ tone: 'danger', label: 'Resolved 1 day late' }], pullRequest: { number: 12 } });
  });

  it('BR-40: a resolved issue summarises how it was resolved', () => {
    const vm = toIssueHistoryVM(resolvedIssue, { planItems: [doneItem], entries: [entry({ people: [grace, { id: 'p2', name: 'Ali' }] })] });

    expect(vm.isResolved).toBe(true);
    expect(vm.summary).toEqual([
      { label: 'Resolved', value: '6 Nov 2026' },
      { label: 'Against the deadline', value: '1 day late' },
      { label: 'Took', value: '4 days' },
      { label: 'Log entries', value: '1' },
      { label: 'Worked on by', value: 'Ali, Grace' },
      { label: 'Pull requests', value: 'app #12' },
    ]);
  });

  it('BR-40: an open issue has a timeline but no summary; on-time and no-work cases read plainly', () => {
    const open = toIssueHistoryVM({ ...resolvedIssue, resolvedOn: null, resolvedBy: null, deadlineState: { state: 'on_track', label: 'Due in 3 days' } }, { planItems: [], entries: [] });
    const onTime = toIssueHistoryVM(
      { ...resolvedIssue, resolvedOn: d('2026-11-03'), resolvedBy: null, deadlineState: { state: 'on_time', label: 'Resolved on time' } },
      { planItems: [], entries: [] },
    );

    expect([open.isResolved, open.summary, open.events.map((e) => e.kind)]).toEqual([false, [], ['assigned']]);
    expect(onTime.summary.map((s) => s.value)).toEqual(['3 Nov 2026', 'On time', '1 day', '0', 'Nobody logged work', 'None']);
  });
});
