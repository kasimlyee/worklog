import type { PlanItemStatus, PrState } from '#src/server/db/types.ts';
import { addDays, formatDate, formatShortDate, isWorkingDay, rangeLabel, weekStart, type IsoDate } from '#src/server/domain/calendar.ts';
import { issueDeadline, openDeadline, overdueCutoff, overdueFrom } from '#src/server/domain/deadlines.ts';
import { reportPeriodLabel } from '#src/server/domain/report-periods.ts';
import type { EntryRow } from '#src/server/repositories/entries.ts';
import type { ReportIssueRow, ReportPlanItemRow } from '#src/server/repositories/reports.ts';
import type { ReportData } from './load.ts';
import type { ReportGroup, ReportLine, ReportModel, ReportSection, StatusTag } from './model.ts';

/* ------------------------------------------------------------- primitives */

function line(text: string, options: Partial<Omit<ReportLine, 'text'>> = {}): ReportLine {
  return { text, tags: [], detail: null, people: [], children: [], ...options };
}

function section(title: string, groups: readonly ReportGroup[], summary: ReportSection['summary'] = []): ReportSection {
  return { title, summary, groups: groups.filter((group) => group.lines.length > 0) };
}

/** R-08: a section is shown only if it has something to show. */
function hasContent(candidate: ReportSection): boolean {
  return candidate.groups.length > 0 || candidate.summary.some((item) => item.value > 0);
}

const names = (people: readonly { readonly name: string }[]): readonly string[] => people.map((person) => person.name);

/* ------------------------------------------------------------------ tags */

const prStateTags: Readonly<Record<PrState, StatusTag>> = {
  open: { tone: 'neutral', label: 'Open' },
  merged: { tone: 'success', label: 'Merged' },
  closed: { tone: 'danger', label: 'Closed' },
};

const doneTag: StatusTag = { tone: 'success', label: 'Done' };
const notDoneTag: StatusTag = { tone: 'danger', label: 'Not done' };
const openTag: StatusTag = { tone: 'neutral', label: 'Open' };
const releasedTag: StatusTag = { tone: 'success', label: 'Released' };

function resolvedTag(issue: ReportIssueRow): StatusTag {
  const state = issueDeadline(issue, issue.resolvedOn ?? issue.deadline);
  return { tone: state.state === 'on_time' ? 'success' : 'danger', label: state.label };
}

/** BR-37: only high and urgent are worth a tag in a report. */
function priorityTags(issue: ReportIssueRow): readonly StatusTag[] {
  switch (issue.priority) {
    case 'urgent':
      return [{ tone: 'danger', label: 'Urgent' }];
    case 'high':
      return [{ tone: 'warning', label: 'High' }];
    case 'medium':
    case 'low':
      return [];
    default:
      return issue.priority satisfies never;
  }
}

function overdueTag(due: IsoDate, asOf: IsoDate): StatusTag {
  return { tone: 'danger', label: openDeadline(due, asOf).label };
}

/** Done by the end of the period (a later completion does not rewrite history). */
function isDoneBy(item: { readonly status: PlanItemStatus; readonly completedOn: IsoDate | null }, end: IsoDate): boolean {
  return item.completedOn !== null && item.completedOn <= end;
}

function isOpenAt(resolvedOn: IsoDate | null, asOf: IsoDate): boolean {
  return resolvedOn === null || resolvedOn > asOf;
}

/* ------------------------------------------------------------ work done */

type AreaBucket = { readonly title: string; readonly entries: EntryRow[] };

/** R-05: areas in the project's order, then "General" for entries without an area. */
function byArea(data: ReportData): readonly AreaBucket[] {
  const buckets = new Map<string | null, AreaBucket>(data.areas.map((area) => [area.id, { title: area.name, entries: [] }]));
  const general: AreaBucket = { title: 'General', entries: [] };
  for (const entry of data.entries) {
    (buckets.get(entry.areaId) ?? general).entries.push(entry);
  }
  return [...buckets.values(), general].filter((bucket) => bucket.entries.length > 0);
}

type PrBucket = { readonly number: number; readonly repo: string; readonly line: ReportLine; readonly entries: EntryRow[] };

/** R-06: PR groups first, by PR number; then entries without a PR in date and creation order. */
function splitByPr(entries: readonly EntryRow[]): { readonly prs: readonly PrBucket[]; readonly loose: readonly EntryRow[] } {
  const prs = new Map<string, PrBucket>();
  const loose: EntryRow[] = [];
  for (const entry of entries) {
    const { pullRequestId, prNumber, prTitle, prState, prRepo } = entry;
    if (pullRequestId === null || prNumber === null || prTitle === null || prState === null || prRepo === null) {
      loose.push(entry);
      continue;
    }
    const bucket = prs.get(pullRequestId) ?? {
      number: prNumber,
      repo: prRepo,
      // R-07: "#{number} {title}" with the PR state and its colour.
      line: line(`#${String(prNumber)} ${prTitle}`, { tags: [prStateTags[prState]] }),
      entries: [],
    };
    bucket.entries.push(entry);
    prs.set(pullRequestId, bucket);
  }
  const sorted = [...prs.values()].sort((a, b) => a.number !== b.number ? a.number - b.number : a.repo.localeCompare(b.repo));
  return { prs: sorted, loose };
}

const titles = (items: readonly { readonly title: string }[]): string => items.map((item) => item.title).join(', ');

/** BR-17: what an entry is linked to travels with it — the issues it worked on and the plan items it fulfils. */
function entryLinks(entry: EntryRow): readonly string[] {
  return [
    ...(entry.issues.length > 0 ? [`${entry.issues.length === 1 ? 'Issue' : 'Issues'}: ${titles(entry.issues)}`] : []),
    ...(entry.planItems.length > 0 ? [`Plan: ${titles(entry.planItems)}`] : []),
  ];
}

function entryLine(entry: EntryRow, withDate: boolean): ReportLine {
  const weekend = !isWorkingDay(entry.workDate);
  const parts = [...(withDate ? [`${formatShortDate(entry.workDate)}${weekend ? ' · weekend work' : ''}`] : []), ...entryLinks(entry)];
  return line(entry.description, { detail: parts.length === 0 ? null : parts.join(' · '), people: names(entry.people) });
}

function count(value: number, one: string, many = `${one}s`): string {
  return `${String(value)} ${value === 1 ? one : many}`;
}

function entryCount(value: number): string {
  return count(value, 'entry', 'entries');
}

/**
 * Daily: area → PR → every entry. Weekly: area → one line per PR → loose entries.
 * Monthly (`in_full`): both — each PR with its entry count and people, then every entry
 * under it with its date, so nothing done in the month is left out.
 */
function workDone(data: ReportData, style: 'every_entry' | 'one_line_per_pr' | 'in_full'): ReportSection {
  const groups = byArea(data).map((bucket): ReportGroup => {
    const { prs, loose } = splitByPr(bucket.entries);
    const withDate = style !== 'every_entry';
    const prLines = prs.map((pr) => {
      const rollUp = {
        detail: entryCount(pr.entries.length),
        people: [...new Set(pr.entries.flatMap((entry) => names(entry.people)))].sort(),
      };
      if (style === 'in_full') {
        return { ...pr.line, ...rollUp, children: pr.entries.map((entry) => entryLine(entry, true)) };
      }
      return style === 'every_entry' ? { ...pr.line, children: pr.entries.map((entry) => entryLine(entry, false)) } : { ...pr.line, ...rollUp };
    });
    return { title: bucket.title, lines: [...prLines, ...loose.map((entry) => entryLine(entry, withDate))] };
  });
  return section('Work done', groups);
}

/* ------------------------------------------------------------- sections */

function releasesSection(data: ReportData, title: string): ReportSection {
  return section(title, [
    {
      title: null,
      lines: data.releases.map((release) =>
        line(release.version, {
          tags: [releasedTag],
          detail: release.releasedOn === null ? null : formatDate(release.releasedOn),
          children: release.pullRequests.map((pr) => line(`#${String(pr.number)} ${pr.title}`, { tags: [prStateTags[pr.state]] })),
        }),
      ),
    },
  ]);
}

function resolvedIssues(data: ReportData): readonly ReportIssueRow[] {
  return data.issues.filter((issue) => issue.resolvedOn !== null && issue.resolvedOn >= data.range.from && issue.resolvedOn <= data.range.to);
}

function openOverdueIssues(data: ReportData): readonly ReportIssueRow[] {
  const cutoff = overdueCutoff(data.asOf);
  return data.issues.filter((issue) => isOpenAt(issue.resolvedOn, data.asOf) && issue.deadline < cutoff);
}

/** Assigned in the period (monthly, §7.4). */
function openedIssues(data: ReportData): readonly ReportIssueRow[] {
  return data.issues.filter((issue) => issue.assignedOn >= data.range.from && issue.assignedOn <= data.range.to);
}

/** Open at the reference date, whatever the deadline (monthly, §7.4). */
function openIssues(data: ReportData): readonly ReportIssueRow[] {
  return data.issues.filter((issue) => issue.assignedOn <= data.asOf && isOpenAt(issue.resolvedOn, data.asOf));
}

/** The dates that tell an issue's story, and the pull request that resolved it (BR-30). */
function issueDetail(issue: ReportIssueRow, asOf: IsoDate): string {
  const resolvedOn = issue.resolvedOn !== null && issue.resolvedOn <= asOf ? issue.resolvedOn : null;
  return [
    `Assigned ${formatShortDate(issue.assignedOn)}`,
    `deadline ${formatShortDate(issue.deadline)}`,
    ...(resolvedOn === null ? [] : [`resolved ${formatShortDate(resolvedOn)}`]),
    ...(resolvedOn !== null && issue.resolvedByNumber !== null && issue.resolvedByTitle !== null
      ? [`by #${String(issue.resolvedByNumber)} ${issue.resolvedByTitle}`]
      : []),
  ].join(' · ');
}

function issueLine(issue: ReportIssueRow, state: StatusTag, asOf: IsoDate): ReportLine {
  return line(issue.title, { tags: [...priorityTags(issue), state], detail: issueDetail(issue, asOf), people: names(issue.assignees) });
}

/** How an issue stood at the reference date: resolved (on time or late), overdue, or simply open. */
function stateAt(issue: ReportIssueRow, asOf: IsoDate): StatusTag {
  if (!isOpenAt(issue.resolvedOn, asOf)) {
    return resolvedTag(issue);
  }
  return issue.deadline < overdueCutoff(asOf) ? overdueTag(issue.deadline, asOf) : openTag;
}

function issuesSection(data: ReportData): ReportSection {
  const resolved = resolvedIssues(data).map((issue) => issueLine(issue, resolvedTag(issue), data.range.to));
  if (data.kind === 'daily') {
    // §7.2: issues that became overdue on this very day.
    const became = data.issues
      .filter((issue) => isOpenAt(issue.resolvedOn, data.start) && overdueFrom(issue.deadline) === data.start)
      .map((issue) => issueLine(issue, overdueTag(issue.deadline, data.start), data.start));
    return section('Issues', [
      { title: 'Resolved', lines: resolved },
      { title: 'Became overdue', lines: became },
    ]);
  }
  const overdue = openOverdueIssues(data);
  const overdueIds = new Set(overdue.map((issue) => issue.id));
  const monthly = data.kind === 'monthly';
  return section('Issues', [
    { title: 'Opened', lines: monthly ? openedIssues(data).map((issue) => issueLine(issue, stateAt(issue, data.asOf), data.asOf)) : [] },
    { title: 'Resolved', lines: resolved },
    { title: 'Still open and overdue', lines: overdue.map((issue) => issueLine(issue, overdueTag(issue.deadline, data.asOf), data.asOf)) },
    {
      title: 'Still open',
      lines: monthly ? openIssues(data).filter((issue) => !overdueIds.has(issue.id)).map((issue) => issueLine(issue, openTag, data.asOf)) : [],
    },
  ]);
}

function touchedPullRequests(data: ReportData): ReadonlyMap<string, PrState> {
  const prs = new Map<string, PrState>();
  for (const entry of data.entries) {
    if (entry.pullRequestId !== null && entry.prState !== null) {
      prs.set(entry.pullRequestId, entry.prState);
    }
  }
  return prs;
}

function summarySection(data: ReportData): ReportSection {
  const prs = touchedPullRequests(data);
  const monthly = data.kind === 'monthly';
  return section(
    'Summary',
    [],
    [
      { label: 'Entries', value: data.entries.length },
      ...(monthly ? [{ label: 'Days with work logged', value: new Set(data.entries.map((entry) => entry.workDate)).size }] : []),
      { label: 'PRs touched', value: prs.size },
      { label: 'PRs merged', value: [...prs.values()].filter((state) => state === 'merged').length },
      { label: 'Releases', value: data.releases.length },
      ...(monthly ? [{ label: 'Issues opened', value: openedIssues(data).length }] : []),
      { label: 'Issues resolved', value: resolvedIssues(data).length },
      ...(monthly
        ? [
            { label: 'Issues still open', value: openIssues(data).length },
            { label: 'Plan items completed', value: data.completedItems.length },
          ]
        : []),
    ],
  );
}

/** §7.4: the month a week at a time — how much was logged, shipped and resolved in each. */
function weekByWeekSection(data: ReportData): ReportSection {
  const { from, to } = data.range;
  const resolved = resolvedIssues(data);
  if (data.entries.length + data.releases.length + resolved.length === 0) {
    return section('Week by week', []);
  }
  const lines: ReportLine[] = [];
  for (let monday = weekStart(from); monday <= to; monday = addDays(monday, 7)) {
    const sunday = addDays(monday, 6);
    const first = monday < from ? from : monday;
    const last = sunday > to ? to : sunday;
    const within = (date: IsoDate | null): boolean => date !== null && date >= first && date <= last;
    const entries = data.entries.filter((entry) => within(entry.workDate));
    const prs = new Set(entries.flatMap((entry) => (entry.pullRequestId === null ? [] : [entry.pullRequestId]))).size;
    const releases = data.releases.filter((release) => within(release.releasedOn)).length;
    const issues = resolved.filter((issue) => within(issue.resolvedOn)).length;
    const parts = [
      ...(entries.length > 0 ? [entryCount(entries.length)] : []),
      ...(prs > 0 ? [count(prs, 'PR')] : []),
      ...(releases > 0 ? [count(releases, 'release')] : []),
      ...(issues > 0 ? [`${count(issues, 'issue')} resolved`] : []),
    ];
    lines.push(
      line(first === last ? formatDate(first) : rangeLabel(first, last), {
        detail: parts.length === 0 ? 'Nothing logged' : parts.join(' · '),
        people: [...new Set(entries.flatMap((entry) => names(entry.people)))].sort(),
      }),
    );
  }
  return section('Week by week', [{ title: null, lines }]);
}

/** §7.3.6 / §7.4.7: per person — entries, issues resolved on time vs late, open overdue items. */
function perDeveloperSection(data: ReportData): ReportSection {
  type Tally = { entries: number; planDone: number; onTime: number; late: number; overdue: number };
  const tallies = new Map<string, Tally>();
  const tally = (name: string): Tally => {
    const existing = tallies.get(name) ?? { entries: 0, planDone: 0, onTime: 0, late: 0, overdue: 0 };
    tallies.set(name, existing);
    return existing;
  };
  for (const entry of data.entries) {
    for (const name of names(entry.people)) {
      tally(name).entries += 1;
    }
  }
  // Plan items finished in the period: the month's completed items, or the done items of the period's own plans.
  const finished =
    data.kind === 'monthly'
      ? data.completedItems
      : data.planItems.filter((item) => item.completedOn !== null && item.completedOn >= data.range.from && item.completedOn <= data.range.to);
  for (const item of finished) {
    for (const name of names(item.assignees)) {
      tally(name).planDone += 1;
    }
  }
  for (const issue of resolvedIssues(data)) {
    const onTime = resolvedTag(issue).tone === 'success';
    for (const name of names(issue.assignees)) {
      if (onTime) {
        tally(name).onTime += 1;
      } else {
        tally(name).late += 1;
      }
    }
  }
  for (const { assignees } of [...openOverdueIssues(data), ...data.overdueItems]) {
    for (const name of names(assignees)) {
      tally(name).overdue += 1;
    }
  }
  const groups = [...tallies.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, t]): ReportGroup => ({
      title: name,
      lines: [
        ...(t.entries > 0 ? [line(`Entries: ${String(t.entries)}`)] : []),
        ...(t.planDone > 0 ? [line(`Plan items completed: ${String(t.planDone)}`)] : []),
        ...(t.onTime + t.late > 0
          ? [
              line(`Issues resolved: ${String(t.onTime + t.late)}`, {
                tags: [
                  ...(t.onTime > 0 ? [{ tone: 'success', label: `${String(t.onTime)} on time` } as const] : []),
                  ...(t.late > 0 ? [{ tone: 'danger', label: `${String(t.late)} late` } as const] : []),
                ],
              }),
            ]
          : []),
        ...(t.overdue > 0 ? [line(`Open overdue items: ${String(t.overdue)}`, { tags: [{ tone: 'danger', label: 'Overdue' }] })] : []),
      ],
    }));
  return section('Per developer', groups);
}

/** Why an unfinished item is unfinished, when its status says so. */
function stuckTags(item: ReportPlanItemRow): readonly StatusTag[] {
  if (item.status === 'blocked') {
    return [{ tone: 'danger', label: 'Blocked' }];
  }
  return item.status === 'in_progress' ? [{ tone: 'warning', label: 'In progress' }] : [];
}

function planItemLine(item: ReportPlanItemRow, done: boolean): ReportLine {
  return line(item.title, {
    tags: done ? [doneTag] : [notDoneTag, ...stuckTags(item)],
    detail: `Due ${formatShortDate(item.dueDate)}`,
    people: names(item.assignees),
  });
}

/** §7.2.5 / §7.3.7 / §7.4.8: done, not done (red), carried over with count, unplanned work. */
function planVsActualSection(data: ReportData): ReportSection {
  const done = data.planItems.filter((item) => isDoneBy(item, data.range.to));
  const notDone = data.planItems.filter((item) => !isDoneBy(item, data.range.to));
  const unplanned = data.entries.filter((entry) => entry.planItems.length === 0);
  const listUnplanned = data.kind !== 'monthly';
  const planned = data.planItems.length + data.moves.length;
  if (planned === 0 && (!listUnplanned || unplanned.length === 0)) {
    return section('Plan vs. actual', []);
  }
  return section(
    'Plan vs. actual',
    [
      { title: 'Done', lines: done.map((item) => planItemLine(item, true)) },
      { title: 'Not done', lines: notDone.map((item) => planItemLine(item, false)) },
      {
        title: `Carried over (${String(data.moves.length)})`,
        lines: data.moves.map((move) =>
          line(move.title, { detail: `Moved from ${formatShortDate(move.fromDue)} to ${formatShortDate(move.toDue)}` }),
        ),
      },
      { title: 'Unplanned work', lines: listUnplanned ? unplanned.map((entry) => entryLine(entry, data.kind === 'weekly')) : [] },
    ],
    [
      { label: 'Planned', value: data.planItems.length },
      { label: 'Done', value: done.length },
      { label: 'Not done', value: notDone.length },
      { label: 'Carried over', value: data.moves.length },
      { label: 'Unplanned entries', value: unplanned.length },
    ],
  );
}

/** §7.4.4: merged PRs per area — title and number only. */
function mergedPrsSection(data: ReportData): ReportSection {
  const groups = byArea(data).map((bucket): ReportGroup => {
    const { prs } = splitByPr(bucket.entries.filter((entry) => entry.prState === 'merged'));
    return { title: bucket.title, lines: prs.map((pr) => ({ ...pr.line, tags: [] })) };
  });
  return section('Merged pull requests', groups);
}

/** §7.4.5: plan items completed this month from week and month plans. */
function completedItemsSection(data: ReportData): ReportSection {
  return section('Completed plan items', [
    {
      title: null,
      lines: data.completedItems.map((item) =>
        line(item.title, {
          tags: [doneTag],
          detail: item.completedOn === null ? null : `Completed ${formatShortDate(item.completedOn)}`,
          people: names(item.assignees),
        }),
      ),
    },
  ]);
}

/* ------------------------------------------------------------------ model */

const typeLabels = { daily: 'Daily report', weekly: 'Weekly report', monthly: 'Monthly report' } as const;

function sectionsFor(data: ReportData): readonly ReportSection[] {
  switch (data.kind) {
    case 'daily':
      return [workDone(data, 'every_entry'), releasesSection(data, 'Releases'), issuesSection(data), planVsActualSection(data)];
    case 'weekly':
      return [
        summarySection(data),
        workDone(data, 'one_line_per_pr'),
        releasesSection(data, 'Releases'),
        issuesSection(data),
        perDeveloperSection(data),
        planVsActualSection(data),
      ];
    case 'monthly':
      return [
        summarySection(data),
        workDone(data, 'in_full'),
        weekByWeekSection(data),
        releasesSection(data, 'Releases'),
        mergedPrsSection(data),
        completedItemsSection(data),
        issuesSection(data),
        perDeveloperSection(data),
        planVsActualSection(data),
      ];
    default:
      return data.kind satisfies never;
  }
}

/** Pure: applies R-01…R-10 and the sections of product spec §7. */
export function buildReportModel(data: ReportData, today: IsoDate): ReportModel {
  const note = data.note.trim();
  return {
    kind: data.kind,
    projectName: data.project.name,
    projectSlug: data.project.slug,
    typeLabel: typeLabels[data.kind],
    periodLabel: reportPeriodLabel(data.kind, data.start),
    periodStart: data.start,
    author: data.author,
    generatedLabel: formatDate(today),
    note: note === '' ? null : note,
    sections: sectionsFor(data).filter(hasContent),
  };
}
