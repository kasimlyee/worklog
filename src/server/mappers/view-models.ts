import 'server-only';
import { datesBetween, daysBetween, formatDate, formatShortDate, dayLabel, isWorkingDay, today as todayIn, type IsoDate } from '#src/server/domain/calendar.ts';
import type { Dashboard, DashboardItem } from '#src/server/services/dashboard.ts';
import type { Entry, EntryPage } from '#src/server/services/entries.ts';
import { priorityRank, type Issue } from '#src/server/services/issues.ts';
import type { IssuePriority } from '#src/server/db/types.ts';
import type { Note } from '#src/server/services/notes.ts';
import type { PlanItem, PlanView } from '#src/server/services/plans.ts';
import { isInPeriod, periodLabel, shiftPeriod, type Horizon } from '#src/server/domain/plans.ts';
import type { Area, Person } from '#src/server/services/projects.ts';
import type { PullRequest } from '#src/server/services/pull-requests.ts';
import type { Release } from '#src/server/services/releases.ts';
import type { PickerOptions } from '#src/server/services/project-chrome.ts';
import type { Pickers, PullRequestVM } from '#src/ui/view-models/common.ts';
import type { DashboardVM, TrackedVM } from '#src/ui/view-models/dashboard.ts';
import type { EntryFormValues, EntryVM, LogDayVM } from '#src/ui/view-models/entries.ts';
import type { IssueDetailVM, IssueHistoryVM, IssueVM, TimelineEventVM } from '#src/ui/view-models/issues.ts';
import type { IssueHistory } from '#src/server/services/issue-history.ts';
import type { NoteFormValues, NoteVM } from '#src/ui/view-models/notes.ts';
import type { PlanItemDetailVM, PlanItemVM, PlansVM } from '#src/ui/view-models/plans.ts';
import type { ReleaseDetailVM, ReleaseVM } from '#src/ui/view-models/releases.ts';
import type { AreaVM, PersonVM, PullRequestRowVM } from '#src/ui/view-models/settings.ts';
import { deadlineTag, issuePriorityTag, issueStatusTag, planStatusTag, prStateTag, releaseStatusTag } from './status.ts';

/* Service outputs → the view-models the UI components accept (docs/04 §3.1). Pure. */

const names = (refs: readonly { readonly name: string }[]): readonly string[] => refs.map((ref) => ref.name);

/** A timestamp shown as a calendar date in the app time zone. */
export function timestampLabel(value: Date | string, timeZone: string): string {
  return formatDate(todayIn(new Date(value), timeZone));
}

export function toPullRequestVM(pr: PullRequest): PullRequestVM {
  return { id: pr.id, number: pr.number, repo: pr.repo, title: pr.title, url: pr.url, state: prStateTag[pr.state] };
}

export function toPullRequestRowVM(pr: PullRequest): PullRequestRowVM {
  return { ...toPullRequestVM(pr), owner: pr.owner };
}

export function toEntryVM(entry: Entry): EntryVM {
  return {
    id: entry.id,
    date: entry.workDate,
    dateLabel: formatShortDate(entry.workDate),
    isWeekend: !isWorkingDay(entry.workDate),
    description: entry.description,
    area: entry.area?.name ?? null,
    people: names(entry.people),
    pullRequest: entry.pullRequest === null ? null : toPullRequestVM(entry.pullRequest),
    planItems: entry.planItems,
    issues: entry.issues,
  };
}

export function toEntryFormValues(entry: Entry): EntryFormValues {
  return {
    workDate: entry.workDate,
    description: entry.description,
    areaId: entry.area?.id ?? '',
    personIds: entry.people.map((person) => person.id),
    prUrl: entry.pullRequest?.url ?? '',
    planItemIds: entry.planItems.map((item) => item.id),
    issueIds: entry.issues.map((issue) => issue.id),
  };
}

/** Entries are newest first; consecutive entries of one date form a day. */
export function toLogDays(page: EntryPage): readonly LogDayVM[] {
  const days: { date: IsoDate; entries: EntryVM[] }[] = [];
  for (const entry of page.entries) {
    const last = days.at(-1);
    if (last?.date === entry.workDate) {
      last.entries.push(toEntryVM(entry));
    } else {
      days.push({ date: entry.workDate, entries: [toEntryVM(entry)] });
    }
  }
  return days.map((day) => ({ date: day.date, label: dayLabel(day.date), isWeekend: !isWorkingDay(day.date), entries: day.entries }));
}

export function toPlanItemVM(item: PlanItem, timeZone: string): PlanItemVM {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    statusTag: planStatusTag[item.status],
    dueDate: item.dueDate,
    dueLabel: `Due ${formatShortDate(item.dueDate)}`,
    deadline: item.deadline === null ? null : deadlineTag(item.deadline),
    area: item.area?.name ?? null,
    assignees: names(item.assignees),
    issue: item.issue?.title ?? null,
    issueId: item.issue?.id ?? null,
    moves: item.moves.map((move) => ({
      fromLabel: formatShortDate(move.fromDue),
      toLabel: formatShortDate(move.toDue),
      whenLabel: timestampLabel(move.movedAt, timeZone),
    })),
  };
}

/**
 * The plans screen. `start` is the period start; `plan` is null only for a weekend day,
 * which has no day plan (BR-03, BR-08).
 */
export function toPlansVM(plan: PlanView | null, horizon: Horizon, start: IsoDate, today: IsoDate, timeZone: string): PlansVM {
  const period = plan?.period ?? { start, end: start };
  return {
    horizon,
    label: plan?.label ?? periodLabel('day', start),
    periodStart: period.start,
    periodEnd: period.end,
    previousQuery: `horizon=${horizon}&date=${shiftPeriod(horizon, start, -1)}`,
    nextQuery: `horizon=${horizon}&date=${shiftPeriod(horizon, start, 1)}`,
    currentQuery: `horizon=${horizon}&date=${today}`,
    canAdd: plan !== null,
    defaultDueDate: isInPeriod(period, today) ? today : period.end,
    items: (plan?.items ?? []).map((item) => toPlanItemVM(item, timeZone)),
    days:
      horizon === 'week'
        ? datesBetween(period.start, period.end).map((date) => ({
            date,
            label: dayLabel(date),
            items: (plan?.items ?? []).filter((item) => item.dueDate === date).map((item) => toPlanItemVM(item, timeZone)),
          }))
        : null,
  };
}

export function toPlanItemDetailVM(item: PlanItem, planLabel: string, timeZone: string): PlanItemDetailVM {
  return {
    ...toPlanItemVM(item, timeZone),
    horizon: item.horizon,
    planLabel,
    form: { title: item.title, areaId: item.area?.id ?? '', issueId: item.issue?.id ?? '', personIds: item.assignees.map((person) => person.id) },
  };
}

export function toIssueVM(issue: Issue): IssueVM {
  return {
    id: issue.id,
    title: issue.title,
    description: issue.description,
    externalUrl: issue.externalUrl,
    area: issue.area?.name ?? null,
    assignees: names(issue.assignees),
    status: issue.status,
    statusTag: issueStatusTag[issue.status],
    priority: issue.priority,
    priorityTag: issuePriorityTag[issue.priority],
    assignedLabel: formatDate(issue.assignedOn),
    deadlineLabel: formatDate(issue.deadline),
    deadline: deadlineTag(issue.deadlineState),
    resolvedOnLabel: issue.resolvedOn === null ? null : formatDate(issue.resolvedOn),
    resolvedBy: issue.resolvedBy === null ? null : toPullRequestVM(issue.resolvedBy),
  };
}

export type IssueListOptions = { readonly priority: IssuePriority | null; readonly sortBy: 'deadline' | 'priority' };

/** BR-37: filter by one priority; sort by priority (urgent first), then by the service's deadline order. */
export function arrangeIssues(issues: readonly Issue[], { priority, sortBy }: IssueListOptions): readonly Issue[] {
  const filtered = priority === null ? issues : issues.filter((issue) => issue.priority === priority);
  return sortBy === 'priority' ? [...filtered].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]) : filtered;
}

export function toIssueDetailVM(issue: Issue): IssueDetailVM {
  return {
    ...toIssueVM(issue),
    form: {
      title: issue.title,
      description: issue.description,
      priority: issue.priority,
      externalUrl: issue.externalUrl ?? '',
      areaId: issue.area?.id ?? '',
      personIds: issue.assignees.map((person) => person.id),
      assignedOn: issue.assignedOn,
      deadline: issue.deadline,
    },
  };
}

function toTrackedVM(item: DashboardItem): TrackedVM {
  if (item.kind === 'issue') {
    return {
      id: item.issue.id,
      kind: 'issue',
      title: item.issue.title,
      dueLabel: `Deadline ${formatShortDate(item.due)}`,
      deadline: deadlineTag(item.issue.deadlineState),
      priority: ['urgent', 'high'].includes(item.issue.priority) ? issuePriorityTag[item.issue.priority] : null,
      people: names(item.issue.assignees),
    };
  }
  return {
    id: item.item.id,
    kind: 'plan_item',
    title: item.item.title,
    dueLabel: `Due ${formatShortDate(item.due)}`,
    // Items in urgent / due soon are never done, so they always have a deadline.
    deadline: item.item.deadline === null ? planStatusTag.done : deadlineTag(item.item.deadline),
    priority: null,
    people: names(item.item.assignees),
  };
}

export function toDashboardVM(dashboard: Dashboard, today: IsoDate, timeZone: string): DashboardVM {
  const todays = dashboard.todaysPlan;
  return {
    todayLabel: dayLabel(today),
    pulse: {
      overdue: dashboard.urgent.filter((item) => (item.kind === 'issue' ? item.issue.deadlineState.state : item.item.deadline?.state) === 'overdue').length,
      dueSoon: dashboard.dueSoon.length,
      today: todays === null ? null : { done: todays.filter((item) => item.status === 'done').length, total: todays.length },
      loggedThisWeek: dashboard.loggedThisWeek,
    },
    urgent: dashboard.urgent.map(toTrackedVM),
    dueSoon: dashboard.dueSoon.map(toTrackedVM),
    todaysPlan: dashboard.todaysPlan === null ? null : dashboard.todaysPlan.map((item) => toPlanItemVM(item, timeZone)),
    openIssues: dashboard.openIssues.map(toIssueVM),
    recentEntries: dashboard.recentEntries.map(toEntryVM),
  };
}

export function toReleaseVM(release: Release): ReleaseVM {
  return {
    id: release.id,
    version: release.version,
    status: releaseStatusTag[release.status],
    targetLabel: release.targetDate === null ? null : formatDate(release.targetDate),
    releasedLabel: release.releasedOn === null ? null : formatDate(release.releasedOn),
    notesHtml: release.notes.trim() === '' ? '' : release.notesHtml,
    pullRequests: release.pullRequests.map(toPullRequestVM),
  };
}

export function toReleaseDetailVM(release: Release, attachedNotes: readonly Note[]): ReleaseDetailVM {
  return {
    ...toReleaseVM(release),
    form: {
      version: release.version,
      status: release.status,
      targetDate: release.targetDate ?? '',
      releasedOn: release.releasedOn ?? '',
      notes: release.notes,
      pullRequestIds: release.pullRequests.map((pr) => pr.id),
    },
    attachedNotes: attachedNotes.map((note) => ({ id: note.id, title: note.title })),
  };
}

export function toNoteVM(note: Note, timeZone: string): NoteVM {
  return {
    id: note.id,
    title: note.title,
    bodyHtml: note.body.trim() === '' ? '' : note.bodyHtml,
    updatedLabel: timestampLabel(note.updatedAt, timeZone),
    release: note.release,
    pullRequest: note.pullRequest === null ? null : toPullRequestVM(note.pullRequest),
    links: note.links,
  };
}

export function toNoteFormValues(note: Note): NoteFormValues {
  return {
    title: note.title,
    body: note.body,
    releaseId: note.release?.id ?? '',
    pullRequestId: note.pullRequest?.id ?? '',
    links: note.links,
  };
}

export const toAreaVM = (area: Area): AreaVM => ({ id: area.id, name: area.name, isArchived: area.isArchived });
export const toPersonVM = (person: Person): PersonVM => ({ id: person.id, name: person.name, isArchived: person.isArchived });

/** Option lists for forms (archived areas and people are already left out, BR-06). */
export function toPickers(options: PickerOptions): Pickers {
  return {
    areas: options.areas.map((area) => ({ value: area.id, label: area.name })),
    people: options.people.map((person) => ({ value: person.id, label: person.name })),
    planItems: options.planItems.map((item) => ({ value: item.id, label: `${item.title} (due ${formatShortDate(item.dueDate)})` })),
    issues: options.issues.map((issue) => ({ value: issue.id, label: issue.title })),
    pullRequests: options.pullRequests.map((pr) => ({ value: pr.id, label: `${pr.repo} #${String(pr.number)} ${pr.title}` })),
    releases: options.releases.map((release) => ({ value: release.id, label: release.version })),
  };
}

const eventOrder: Readonly<Record<TimelineEventVM['kind'], number>> = { assigned: 0, planned: 1, logged: 2, resolved: 3 };

function days(count: number): string {
  return `${String(count)} ${count === 1 ? 'day' : 'days'}`;
}

/** BR-40: an issue's history as a dated timeline, and — once resolved — how it was resolved. */
export function toIssueHistoryVM(issue: Issue, history: IssueHistory): IssueHistoryVM {
  type EventFields = Pick<TimelineEventVM, 'key' | 'kind' | 'title'> & Partial<Omit<TimelineEventVM, 'date' | 'dateLabel'>>;
  const event = (date: IsoDate, fields: EventFields): TimelineEventVM => ({
    detail: null,
    people: [],
    tags: [],
    planItemId: null,
    entryId: null,
    pullRequest: null,
    ...fields,
    date,
    dateLabel: formatDate(date),
  });
  const events: TimelineEventVM[] = [
    event(issue.assignedOn, { key: 'assigned', kind: 'assigned', title: 'Assigned', detail: `Deadline ${formatDate(issue.deadline)}`, people: names(issue.assignees) }),
    ...history.planItems.map((item) =>
      event(item.completedOn ?? item.dueDate, {
        key: `plan-${item.id}`,
        kind: 'planned',
        title: item.title,
        detail: [
          item.completedOn === null ? `Planned for ${formatShortDate(item.dueDate)}` : `Planned for ${formatShortDate(item.dueDate)}, done ${formatShortDate(item.completedOn)}`,
          item.moves.length > 0 ? `moved ${String(item.moves.length)}×` : null,
        ]
          .filter((part) => part !== null)
          .join(' · '),
        people: names(item.assignees),
        tags: [planStatusTag[item.status]],
        planItemId: item.id,
      }),
    ),
    ...history.entries.map((entry) =>
      event(entry.workDate, {
        key: `entry-${entry.id}`,
        kind: 'logged',
        title: entry.description,
        detail: entry.area?.name ?? null,
        people: names(entry.people),
        entryId: entry.id,
        pullRequest: entry.pullRequest === null ? null : toPullRequestVM(entry.pullRequest),
      }),
    ),
    ...(issue.resolvedOn === null
      ? []
      : [
          event(issue.resolvedOn, {
            key: 'resolved',
            kind: 'resolved',
            title: 'Resolved',
            tags: [deadlineTag(issue.deadlineState)],
            pullRequest: issue.resolvedBy === null ? null : toPullRequestVM(issue.resolvedBy),
          }),
        ]),
  ];
  events.sort((a, b) => (a.date === b.date ? eventOrder[a.kind] - eventOrder[b.kind] : a.date < b.date ? -1 : 1));

  if (issue.resolvedOn === null) {
    return { isResolved: false, summary: [], events };
  }
  const people = [...new Set(history.entries.flatMap((entry) => names(entry.people)))].sort();
  const pullRequests = new Map<string, string>();
  for (const pr of [...history.entries.map((entry) => entry.pullRequest), issue.resolvedBy]) {
    if (pr !== null) {
      pullRequests.set(pr.id, `${pr.repo} #${String(pr.number)}`);
    }
  }
  const late = issue.deadlineState.state === 'late';
  return {
    isResolved: true,
    summary: [
      { label: 'Resolved', value: formatDate(issue.resolvedOn) },
      { label: 'Against the deadline', value: late ? issue.deadlineState.label.replace(/^Resolved /, '') : 'On time' },
      { label: 'Took', value: days(daysBetween(issue.assignedOn, issue.resolvedOn)) },
      { label: 'Log entries', value: String(history.entries.length) },
      { label: 'Worked on by', value: people.length === 0 ? 'Nobody logged work' : people.join(', ') },
      { label: 'Pull requests', value: pullRequests.size === 0 ? 'None' : [...pullRequests.values()].join(', ') },
    ],
    events,
  };
}
