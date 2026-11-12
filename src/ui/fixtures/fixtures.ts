import type { Pickers, PullRequestVM, StatusVM } from '#src/ui/view-models/common.ts';
import type { DashboardVM } from '#src/ui/view-models/dashboard.ts';
import type { EntryFormValues, EntryVM, LogVM } from '#src/ui/view-models/entries.ts';
import type { IssueDetailVM, IssueHistoryVM, IssueVM, TimelineEventVM } from '#src/ui/view-models/issues.ts';
import type { NoteFormValues, NoteVM } from '#src/ui/view-models/notes.ts';
import type { PlanItemDetailVM, PlanItemVM, PlansVM } from '#src/ui/view-models/plans.ts';
import type { ReleaseDetailVM, ReleaseVM } from '#src/ui/view-models/releases.ts';
import type { ReportModelVM, ReportsVM } from '#src/ui/view-models/reports.ts';
import type { PersonVM, PullRequestRowVM, SettingsVM } from '#src/ui/view-models/settings.ts';
import type { ProjectHeaderVM, ProjectSummaryVM } from '#src/ui/view-models/shell.ts';

/* Realistic view-models for every screen state: empty, normal, long text, many items, every status. */

export const projectId = '11111111-1111-4111-8111-111111111111';
export const today = '2026-11-10';

const status = (tone: StatusVM['tone'], label: string): StatusVM => ({ tone, label });

export const statuses = {
  merged: status('success', 'Merged'),
  open: status('neutral', 'Open'),
  closed: status('danger', 'Closed'),
  planned: status('neutral', 'Planned'),
  inProgress: status('warning', 'In progress'),
  done: status('success', 'Done'),
  blocked: status('danger', 'Blocked'),
  overdue: status('danger', '3 days overdue'),
  dueSoon: status('warning', 'Due tomorrow'),
  onTrack: status('neutral', 'Due in 6 days'),
  onTime: status('success', 'Resolved on time'),
  late: status('danger', 'Resolved 2 days late'),
  released: status('success', 'Released'),
} as const;

export const longText =
  'Reworked the invoice export so that very long customer names, multi-line addresses and unusual characters like Łódź, Zoë and 中文 wrap correctly instead of overflowing the table and pushing the totals column off the printed page';

export const pickers: Pickers = {
  areas: [
    { value: 'a1', label: 'Frontend' },
    { value: 'a2', label: 'Backend' },
    { value: 'a3', label: 'Mobile' },
  ],
  people: [
    { value: 'p1', label: 'Ali' },
    { value: 'p2', label: 'Grace' },
    { value: 'p3', label: 'Wanjiru' },
  ],
  planItems: [{ value: 'i1', label: 'Ship login (due Thu 12 Nov)' }],
  issues: [{ value: 's1', label: 'Crash on save' }],
  pullRequests: [{ value: 'pr12', label: 'app #12 Add login' }],
  releases: [{ value: 'r1', label: '1.4.0' }],
};

export const emptyPickers: Pickers = { areas: [], people: [], planItems: [], issues: [], pullRequests: [], releases: [] };

export const pullRequest: PullRequestVM = {
  id: 'pr12',
  number: 12,
  repo: 'app',
  title: 'Add login',
  url: 'https://github.com/acme/app/pull/12',
  state: statuses.merged,
};

const loginEntry: EntryVM = {
  id: 'e1',
  date: '2026-11-10',
  dateLabel: 'Tue 10 Nov',
  isWeekend: false,
  description: 'Wired the login form to the session API',
  area: 'Frontend',
  people: ['Ali', 'Grace'],
  pullRequest,
  planItems: [{ id: 'i1', title: 'Ship login' }],
  issues: [],
};
const weekendEntry: EntryVM = {
  id: 'e2',
  date: '2026-11-08',
  dateLabel: 'Sun 8 Nov',
  isWeekend: true,
  description: 'Hotfix for the payment webhook',
  area: null,
  people: ['Wanjiru'],
  pullRequest: null,
  planItems: [],
  issues: [
    { id: 's1', title: 'Crash on save' },
    { id: 's2', title: 'Slow dashboard query' },
  ],
};
const longEntry: EntryVM = {
  id: 'e3',
  date: '2026-11-06',
  dateLabel: 'Fri 6 Nov',
  isWeekend: false,
  description: longText,
  area: 'Backend',
  people: ['Grace'],
  pullRequest: { ...pullRequest, id: 'pr13', number: 13, title: 'Experiment: new cache', state: statuses.closed },
  planItems: [],
  issues: [],
};

export const entries: readonly EntryVM[] = [loginEntry, weekendEntry, longEntry];

const shipLogin: PlanItemVM = {
  id: 'i1',
  title: 'Ship login',
  status: 'in_progress',
  statusTag: statuses.inProgress,
  dueDate: '2026-11-12',
  dueLabel: 'Due Thu 12 Nov',
  deadline: statuses.onTrack,
  area: 'Frontend',
  assignees: ['Ali', 'Grace'],
  issue: null,
  issueId: null,
  moves: [],
};
const billing: PlanItemVM = {
  id: 'i2',
  title: 'Migrate billing tables',
  status: 'blocked',
  statusTag: statuses.blocked,
  dueDate: '2026-11-06',
  dueLabel: 'Due Fri 6 Nov',
  deadline: statuses.overdue,
  area: 'Backend',
  assignees: ['Wanjiru'],
  issue: 'Crash on save',
  issueId: 's1',
  moves: [{ fromLabel: 'Wed 4 Nov', toLabel: 'Fri 6 Nov', whenLabel: '4 Nov 2026' }],
};
const releaseNotes: PlanItemVM = {
  id: 'i3',
  title: 'Write release notes',
  status: 'done',
  statusTag: statuses.done,
  dueDate: '2026-11-10',
  dueLabel: 'Due Tue 10 Nov',
  deadline: null,
  area: null,
  assignees: [],
  issue: null,
  issueId: null,
  moves: [],
};
const onboarding: PlanItemVM = {
  id: 'i4',
  title: 'Review the onboarding copy',
  status: 'planned',
  statusTag: statuses.planned,
  dueDate: '2026-11-11',
  dueLabel: 'Due Wed 11 Nov',
  deadline: statuses.dueSoon,
  area: 'Mobile',
  assignees: ['Ali'],
  issue: null,
  issueId: null,
  moves: [],
};

export const planItems: readonly PlanItemVM[] = [shipLogin, billing, releaseNotes, onboarding];

const crash: IssueVM = {
  id: 's1',
  title: 'Crash on save',
  description: 'Saving a listing with more than 10 photos crashes the app on Android 13.\nSeen by two brokers today.',
  externalUrl: 'https://jira.example.com/browse/APP-12',
  area: 'Mobile',
  assignees: ['Grace'],
  status: 'open',
  statusTag: statuses.open,
  priority: 'urgent',
  priorityTag: status('danger', 'Urgent'),
  assignedLabel: '2 Nov 2026',
  deadlineLabel: '6 Nov 2026',
  deadline: statuses.overdue,
  resolvedOnLabel: null,
  resolvedBy: null,
};
const slowQuery: IssueVM = {
  id: 's2',
  title: 'Slow dashboard query',
  description: '',
  externalUrl: null,
  area: null,
  assignees: ['Ali', 'Wanjiru'],
  status: 'in_progress',
  statusTag: statuses.inProgress,
  priority: 'high',
  priorityTag: status('warning', 'High'),
  assignedLabel: '9 Nov 2026',
  deadlineLabel: '11 Nov 2026',
  deadline: statuses.dueSoon,
  resolvedOnLabel: null,
  resolvedBy: null,
};
const typo: IssueVM = {
  id: 's3',
  title: 'Typo on invoice',
  description: '',
  externalUrl: null,
  area: 'Frontend',
  assignees: ['Grace'],
  status: 'resolved',
  statusTag: status('success', 'Resolved'),
  priority: 'low',
  priorityTag: status('neutral', 'Low'),
  assignedLabel: '1 Nov 2026',
  deadlineLabel: '3 Nov 2026',
  deadline: statuses.late,
  resolvedOnLabel: '5 Nov 2026',
  resolvedBy: pullRequest,
};

export const issues: readonly IssueVM[] = [crash, slowQuery, typo];

export const projects: readonly ProjectSummaryVM[] = [
  { id: projectId, name: 'Atlas', description: 'Field service app', overdueCount: 3 },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Borealis', description: '', overdueCount: 0 },
];

export const projectHeader: ProjectHeaderVM = { id: projectId, name: 'Atlas', isArchived: false, overdueCount: 3 };

export const dashboard: DashboardVM = {
  todayLabel: 'Tuesday 10 Nov 2026',
  pulse: { overdue: 2, dueSoon: 1, today: { done: 1, total: 2 }, loggedThisWeek: 7 },
  urgent: [
    { id: 's1', kind: 'issue', title: 'Crash on save', dueLabel: 'Deadline 6 Nov', deadline: statuses.overdue, priority: status('danger', 'Urgent'), people: ['Grace'] },
    { id: 'i2', kind: 'plan_item', title: 'Migrate billing tables', dueLabel: 'Due Fri 6 Nov', deadline: statuses.overdue, priority: null, people: ['Wanjiru'] },
  ],
  dueSoon: [{ id: 'i4', kind: 'plan_item', title: 'Review the onboarding copy', dueLabel: 'Due Wed 11 Nov', deadline: statuses.dueSoon, priority: null, people: ['Ali'] }],
  todaysPlan: [releaseNotes, shipLogin],
  openIssues: [crash, slowQuery],
  recentEntries: entries,
};

export const emptyDashboard: DashboardVM = {
  todayLabel: 'Saturday 14 Nov 2026',
  pulse: { overdue: 0, dueSoon: 0, today: null, loggedThisWeek: 0 },
  urgent: [], dueSoon: [], todaysPlan: null, openIssues: [], recentEntries: [] };

export const plans: PlansVM = {
  horizon: 'week',
  label: 'Week of 9–13 Nov 2026',
  periodStart: '2026-11-09',
  periodEnd: '2026-11-13',
  previousQuery: 'horizon=week&date=2026-11-02',
  nextQuery: 'horizon=week&date=2026-11-16',
  currentQuery: 'horizon=week&date=2026-11-10',
  canAdd: true,
  defaultDueDate: '2026-11-13',
  items: planItems,
  days: [
    { date: '2026-11-09', label: 'Monday 9 Nov 2026', items: [billing] },
    { date: '2026-11-10', label: 'Tuesday 10 Nov 2026', items: [releaseNotes] },
    { date: '2026-11-11', label: 'Wednesday 11 Nov 2026', items: [onboarding] },
    { date: '2026-11-12', label: 'Thursday 12 Nov 2026', items: [shipLogin] },
    { date: '2026-11-13', label: 'Friday 13 Nov 2026', items: [] },
  ],
};

export const weekendDayPlan: PlansVM = {
  ...plans,
  horizon: 'day',
  label: 'Saturday 14 Nov 2026',
  periodStart: '2026-11-14',
  periodEnd: '2026-11-14',
  canAdd: false,
  items: [],
  days: null,
};

export const planItemDetail: PlanItemDetailVM = {
  ...billing,
  horizon: 'week',
  planLabel: 'Week of 2–6 Nov 2026',
  form: { title: 'Migrate billing tables', areaId: 'a2', issueId: 's1', personIds: ['p3'] },
};

export const log: LogVM = {
  days: [
    { date: '2026-11-10', label: 'Tuesday 10 Nov 2026', isWeekend: false, entries: [loginEntry] },
    { date: '2026-11-08', label: 'Sunday 8 Nov 2026', isWeekend: true, entries: [weekendEntry] },
    { date: '2026-11-06', label: 'Friday 6 Nov 2026', isWeekend: false, entries: [longEntry] },
  ],
  filters: { areaId: '', personId: '', pullRequestId: '', issueId: '', planItemId: '' },
  isFiltered: false,
  nextPageQuery: 'cursor=abc',
};

export const emptyLog: LogVM = { days: [], filters: { areaId: 'a1', personId: '', pullRequestId: '', issueId: '', planItemId: '' }, isFiltered: true, nextPageQuery: null };

export const entryValues: EntryFormValues = {
  workDate: '2026-11-10',
  description: 'Wired the login form to the session API',
  areaId: 'a1',
  personIds: ['p1', 'p2'],
  prUrl: 'https://github.com/acme/app/pull/12',
  planItemIds: ['i1'],
  issueIds: [],
};

export const issueDetail: IssueDetailVM = {
  ...crash,
  form: { title: 'Crash on save', description: 'Saving a listing with more than 10 photos crashes the app on Android 13.\nSeen by two brokers today.', priority: 'urgent', externalUrl: 'https://jira.example.com/browse/APP-12', areaId: 'a3', personIds: ['p2'], assignedOn: '2026-11-02', deadline: '2026-11-06' },
};

export const resolvedIssueDetail: IssueDetailVM = { ...issueDetail, ...(issues[2] ?? issues[0]) };

const nextRelease: ReleaseVM = { id: 'r2', version: '1.5.0', status: statuses.planned, targetLabel: '20 Nov 2026', releasedLabel: null, notesHtml: '', pullRequests: [] };
const shipped: ReleaseVM = {
  id: 'r1',
  version: '1.4.0',
  status: statuses.released,
  targetLabel: '10 Nov 2026',
  releasedLabel: '12 Nov 2026',
  notesHtml: '<p><strong>Highlights</strong>: sign-in with GitHub.</p>\n',
  pullRequests: [pullRequest],
};

export const releases: readonly ReleaseVM[] = [nextRelease, shipped];

export const releaseDetail: ReleaseDetailVM = {
  ...shipped,
  form: { version: '1.4.0', status: 'released', targetDate: '2026-11-10', releasedOn: '2026-11-12', notes: '**Highlights**: sign-in with GitHub.', pullRequestIds: ['pr12'] },
  attachedNotes: [{ id: 'n1', title: 'Rollout checklist' }],
};

export const note: NoteVM = {
  id: 'n1',
  title: 'Rollout checklist',
  bodyHtml: '<h3>Steps</h3>\n<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>\n<ul>\n<li>Back up the database</li>\n</ul>\n',
  updatedLabel: '9 Nov 2026',
  release: { id: 'r1', version: '1.4.0' },
  pullRequest,
  links: [{ label: 'Runbook', url: 'https://docs.example.com/runbook' }],
};

export const notes: readonly NoteVM[] = [note];

export const noteValues: NoteFormValues = {
  title: 'Rollout checklist',
  body: '# Steps\n\n- Back up the database',
  releaseId: 'r1',
  pullRequestId: '',
  links: [{ label: 'Runbook', url: 'https://docs.example.com/runbook' }],
};

export const reportModel: ReportModelVM = {
  projectName: 'Atlas',
  typeLabel: 'Weekly report',
  periodLabel: 'Week of 9–13 Nov 2026',
  author: 'Kasim',
  generatedLabel: '20 Nov 2026',
  note: 'Short week: public holiday on Friday.',
  sections: [
    {
      title: 'Summary',
      summary: [
        { label: 'Entries', value: 4 },
        { label: 'PRs touched', value: 2 },
      ],
      groups: [],
    },
    {
      title: 'Work done',
      summary: [],
      groups: [
        {
          title: 'Frontend',
          lines: [{ text: '#12 Add login', tags: [statuses.merged], detail: '2 entries', people: ['Ali', 'Grace'], children: [] }],
        },
        {
          title: 'General',
          lines: [{ text: 'Hotfix on Saturday', tags: [], detail: 'Sat 14 Nov · weekend work', people: ['Wanjiru'], children: [] }],
        },
      ],
    },
  ],
};

export const reports: ReportsVM = {
  kind: 'weekly',
  start: '2026-11-09',
  previousQuery: 'kind=weekly&date=2026-11-02',
  nextQuery: 'kind=weekly&date=2026-11-16',
  pdfHref: `/projects/${projectId}/reports/export?kind=weekly&start=2026-11-09&format=pdf`,
  markdownHref: `/projects/${projectId}/reports/export?kind=weekly&start=2026-11-09&format=md`,
  note: 'Short week: public holiday on Friday.',
  model: reportModel,
};

const reportLine = (text: string, detail: string | null = null, people: readonly string[] = [], tags: ReportModelVM['sections'][number]['groups'][number]['lines'][number]['tags'] = []) => ({
  text,
  tags,
  detail,
  people,
  children: [],
});

/** A month in full (product spec §7.4): every entry, week by week, and each issue's story. */
export const monthlyReports: ReportsVM = {
  ...reports,
  kind: 'monthly',
  start: '2026-11-01',
  note: '',
  model: {
    ...reportModel,
    typeLabel: 'Monthly report',
    periodLabel: 'November 2026',
    note: null,
    sections: [
      {
        title: 'Summary',
        summary: [
          { label: 'Entries', value: 4 },
          { label: 'Days with work logged', value: 4 },
          { label: 'PRs touched', value: 1 },
          { label: 'PRs merged', value: 1 },
          { label: 'Releases', value: 1 },
          { label: 'Issues opened', value: 2 },
          { label: 'Issues resolved', value: 1 },
          { label: 'Issues still open', value: 1 },
          { label: 'Plan items completed', value: 1 },
        ],
        groups: [],
      },
      {
        title: 'Work done',
        summary: [],
        groups: [
          {
            title: 'Frontend',
            lines: [
              {
                ...reportLine('#12 Add login', '2 entries', ['Ali', 'Grace'], [statuses.merged]),
                children: [
                  reportLine('Wired the login form to the session API', 'Tue 10 Nov · Plan: Ship login', ['Ali', 'Grace']),
                  reportLine('Review fixes and tests', 'Thu 12 Nov', ['Grace']),
                ],
              },
            ],
          },
          {
            title: 'General',
            lines: [
              reportLine('Hotfix for the payment webhook', 'Sun 8 Nov · weekend work · Issue: Crash on save', ['Wanjiru']),
              reportLine('Server upgrade', 'Mon 23 Nov', ['Ali']),
            ],
          },
        ],
      },
      {
        title: 'Week by week',
        summary: [],
        groups: [
          {
            title: null,
            lines: [
              reportLine('1 Nov 2026', 'Nothing logged'),
              reportLine('2–8 Nov 2026', '1 entry', ['Wanjiru']),
              reportLine('9–15 Nov 2026', '2 entries · 1 PR · 1 release · 1 issue resolved', ['Ali', 'Grace']),
              reportLine('16–22 Nov 2026', 'Nothing logged'),
              reportLine('23–29 Nov 2026', '1 entry', ['Ali']),
              reportLine('30 Nov 2026', 'Nothing logged'),
            ],
          },
        ],
      },
      {
        title: 'Issues',
        summary: [],
        groups: [
          {
            title: 'Opened',
            lines: [
              reportLine('Crash on save', 'Assigned Mon 2 Nov · deadline Fri 6 Nov · resolved Thu 12 Nov · by #12 Add login', ['Grace'], [
                { tone: 'danger', label: 'Urgent' },
                { tone: 'danger', label: 'Resolved 4 days late' },
              ]),
              reportLine('Slow dashboard query', 'Assigned Mon 9 Nov · deadline Fri 11 Dec', ['Ali', 'Wanjiru'], [{ tone: 'warning', label: 'High' }, statuses.open]),
            ],
          },
          {
            title: 'Still open',
            lines: [reportLine('Slow dashboard query', 'Assigned Mon 9 Nov · deadline Fri 11 Dec', ['Ali', 'Wanjiru'], [{ tone: 'warning', label: 'High' }, statuses.open])],
          },
        ],
      },
    ],
  },
};

export const emptyReports: ReportsVM = { ...reports, note: '', model: { ...reportModel, note: null, sections: [] } };

export const settings: SettingsVM = {
  project: { id: projectId, name: 'Atlas', description: 'Field service app', isArchived: false },
  areas: [
    { id: 'a1', name: 'Frontend', isArchived: false },
    { id: 'a2', name: 'Backend', isArchived: false },
    { id: 'a3', name: 'Mobile', isArchived: false },
    { id: 'a4', name: 'Legacy', isArchived: true },
  ],
};

export const people: readonly PersonVM[] = [
  { id: 'p1', name: 'Ali', isArchived: false },
  { id: 'p2', name: 'Grace', isArchived: false },
  { id: 'p9', name: 'Former Dev', isArchived: true },
];

export const pullRequestRows: readonly PullRequestRowVM[] = [
  { ...pullRequest, owner: 'acme' },
  { ...pullRequest, id: 'pr14', number: 14, title: 'Error states', state: statuses.open, owner: 'acme' },
];

export const manyEntries: readonly EntryVM[] = Array.from({ length: 60 }, (_, index) => ({
  ...loginEntry,
  id: `many-${String(index)}`,
  description: `Entry ${String(index + 1)}`,
}));

const event = (fields: Partial<TimelineEventVM> & Pick<TimelineEventVM, 'key' | 'date' | 'dateLabel' | 'kind' | 'title'>): TimelineEventVM => ({
  detail: null,
  people: [],
  tags: [],
  planItemId: null,
  entryId: null,
  pullRequest: null,
  ...fields,
});

const assignedEvent = event({ key: 'assigned', date: '2026-11-02', dateLabel: '2 Nov 2026', kind: 'assigned', title: 'Assigned', detail: 'Deadline 6 Nov 2026', people: ['Grace'] });

export const openIssueHistory: IssueHistoryVM = {
  isResolved: false,
  summary: [],
  events: [
    assignedEvent,
    event({ key: 'plan-i9', date: '2026-11-10', dateLabel: '10 Nov 2026', kind: 'planned', title: 'Crash on save', detail: 'Planned for Tue 10 Nov', people: ['Grace'], tags: [statuses.inProgress], planItemId: 'i9' }),
  ],
};

export const resolvedIssueHistory: IssueHistoryVM = {
  isResolved: true,
  summary: [
    { label: 'Resolved', value: '5 Nov 2026' },
    { label: 'Against the deadline', value: '2 days late' },
    { label: 'Took', value: '4 days' },
    { label: 'Log entries', value: '2' },
    { label: 'Worked on by', value: 'Ali, Grace' },
    { label: 'Pull requests', value: 'app #12' },
  ],
  events: [
    assignedEvent,
    event({ key: 'entry-e7', date: '2026-11-03', dateLabel: '3 Nov 2026', kind: 'logged', title: 'Found the cause: the old API server', people: ['Ali'], entryId: 'e7' }),
    event({ key: 'plan-i9', date: '2026-11-05', dateLabel: '5 Nov 2026', kind: 'planned', title: 'Fix share links', detail: 'Planned for Wed 4 Nov, done Thu 5 Nov · moved 1×', people: ['Grace'], tags: [statuses.done], planItemId: 'i9' }),
    event({ key: 'entry-e8', date: '2026-11-05', dateLabel: '5 Nov 2026', kind: 'logged', title: 'Moved go.nestlyhousing.org to the new VM', detail: 'Backend', people: ['Grace'], entryId: 'e8', pullRequest }),
    event({ key: 'resolved', date: '2026-11-05', dateLabel: '5 Nov 2026', kind: 'resolved', title: 'Resolved', tags: [statuses.late], pullRequest }),
  ],
};
