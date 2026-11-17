import 'server-only';
import * as z from 'zod';
import { err, ok, type Result } from '#src/lib/result.ts';
import type { Db } from '#src/server/db/client.ts';
import type { PlanItemStatus } from '#src/server/db/types.ts';
import { addDays, formatDate, formatShortDate, isoWeek, monthEnd, parseIsoDate, weekday, weekStart, type IsoDate } from '#src/server/domain/calendar.ts';
import { periodLabel } from '#src/server/domain/plans.ts';
import { selectPlanItems, type PlanItemRow } from '#src/server/repositories/plans.ts';
import { selectProject } from '#src/server/repositories/projects.ts';
import type { ReportGroup, ReportLine, ReportModel, ReportSection, StatusTag } from './model.ts';

/*
 * BR-47: a week's or a month's plan as a file, drawn by the report renderers (PDF and
 * Markdown) so it looks like the reports. Plans only — no log entries, issues or releases.
 */

export type PlanExportKind = 'weekly' | 'monthly';
export type PlanExportRequest = { readonly kind: PlanExportKind; readonly start: IsoDate };

const requestSchema = z.object({ kind: z.enum(['weekly', 'monthly']), start: z.string().max(10) });

/** Weekly starts on a Monday, monthly on the 1st. */
export function parsePlanExportRequest(input: unknown): Result<PlanExportRequest, 'invalid_request'> {
  const parsed = requestSchema.safeParse(input);
  const start = parsed.success ? parseIsoDate(parsed.data.start) : null;
  if (!parsed.success || start === null) {
    return err('invalid_request');
  }
  const valid = parsed.data.kind === 'weekly' ? weekday(start) === 1 : start.endsWith('-01');
  return valid ? ok({ kind: parsed.data.kind, start }) : err('invalid_request');
}

export type PlanExportData = {
  readonly kind: PlanExportKind;
  readonly start: IsoDate;
  readonly project: { readonly name: string; readonly slug: string };
  readonly author: string;
  /** Every item due in the period (Monday–Sunday for a week), of any plan. */
  readonly items: readonly PlanItemRow[];
};

/** The calendar dates the export covers: a week runs Monday–Sunday, so weekend items appear. */
export function planExportRange(kind: PlanExportKind, start: IsoDate): { readonly from: IsoDate; readonly to: IsoDate } {
  return { from: start, to: kind === 'weekly' ? addDays(start, 6) : monthEnd(start) };
}

/** Two queries. Null for an unknown project. */
export async function loadPlanExportData(
  db: Db,
  projectId: string,
  request: PlanExportRequest,
  author: string,
): Promise<PlanExportData | null> {
  const [project, items] = await Promise.all([
    selectProject(db, projectId),
    selectPlanItems(db, projectId, { dueBetween: planExportRange(request.kind, request.start) }),
  ]);
  return project === undefined ? null : { ...request, project: { name: project.name, slug: project.slug }, author, items };
}

const statusTags: Readonly<Record<PlanItemStatus, StatusTag>> = {
  planned: { tone: 'neutral', label: 'Planned' },
  in_progress: { tone: 'warning', label: 'In progress' },
  done: { tone: 'success', label: 'Done' },
  blocked: { tone: 'danger', label: 'Blocked' },
};

/** BR-48: the item's description sits on a second line under its title. */
function itemLine(item: PlanItemRow, cells: Readonly<Record<string, string>>): ReportLine {
  return {
    text: item.title,
    tags: [statusTags[item.status]],
    detail: item.description === '' ? null : item.description,
    people: item.assignees.map((person) => person.name),
    cells: Object.entries(cells).map(([label, text]) => ({ label, text })),
    children: [],
  };
}

const area = (item: PlanItemRow): string => item.areaName ?? 'General';
const byDue = (a: PlanItemRow, b: PlanItemRow): number => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : a.position - b.position);

const goalColumns: NonNullable<ReportGroup['columns']> = [
  { label: 'Goal', from: 'text', withDetail: true },
  { label: 'Area', from: { cell: 'Area' } },
  { label: 'Due', from: { cell: 'Due' } },
  { label: 'Owner', from: 'people' },
  { label: 'Status', from: 'tags' },
];

const deliverableColumns: NonNullable<ReportGroup['columns']> = [
  { label: 'When', from: { cell: 'When' } },
  { label: 'Deliverable', from: 'text', withDetail: true },
  { label: 'Area', from: { cell: 'Area' } },
  { label: 'Owner', from: 'people' },
  { label: 'Status', from: 'tags' },
];

function goalLines(items: readonly PlanItemRow[]): readonly ReportLine[] {
  return [...items].sort(byDue).map((item) => itemLine(item, { Area: area(item), Due: formatShortDate(item.dueDate) }));
}

function deliverableLines(items: readonly PlanItemRow[]): readonly ReportLine[] {
  return [...items].sort(byDue).map((item) => itemLine(item, { When: formatShortDate(item.dueDate), Area: area(item) }));
}

function summary(items: readonly PlanItemRow[]): ReportSection {
  const count = (status: PlanItemStatus): number => items.filter((item) => item.status === status).length;
  return {
    title: 'Summary',
    summary: [
      { label: 'Planned items', value: items.length },
      { label: 'Done', value: count('done') },
      { label: 'In progress', value: count('in_progress') },
      { label: 'Blocked', value: count('blocked') },
      { label: 'Not started', value: count('planned') },
    ],
    groups: [],
  };
}

function section(title: string, groups: readonly ReportGroup[]): ReportSection {
  return { title, summary: [], groups: groups.filter((group) => group.lines.length > 0) };
}

const countLabel = (n: number): string => `${String(n)} ${n === 1 ? 'item' : 'items'}`;

/** By area, and by day (week) or by week (month): how much is planned and how much is done. */
function panels(items: readonly PlanItemRow[], buckets: readonly { readonly label: string; readonly items: readonly PlanItemRow[] }[], bucketTitle: string): NonNullable<ReportModel['panels']> {
  const areas = [...new Set(items.map(area))].sort((a, b) => (a === 'General' ? 1 : b === 'General' ? -1 : a.localeCompare(b)));
  const done = (list: readonly PlanItemRow[]): number => list.filter((item) => item.status === 'done').length;
  return [
    {
      title: 'By area',
      items: areas.map((name) => {
        const mine = items.filter((item) => area(item) === name);
        return `${name}: ${countLabel(mine.length)}, ${String(done(mine))} done`;
      }),
    },
    {
      title: bucketTitle,
      items: buckets.filter((bucket) => bucket.items.length > 0).map((bucket) => `${bucket.label}: ${countLabel(bucket.items.length)}, ${String(done(bucket.items))} done`),
    },
  ];
}

/** Week: the week's goals, then every other item in date order, Monday to Sunday. */
function weekly(data: PlanExportData): Pick<ReportModel, 'sections' | 'panels'> {
  const goals = data.items.filter((item) => item.horizon === 'week' && item.periodStart === data.start);
  const deliverables = data.items.filter((item) => !goals.includes(item));
  return {
    panels: panels(
      data.items,
      Array.from({ length: 7 }, (_, index) => addDays(data.start, index)).map((day) => ({
        label: formatShortDate(day),
        // BR-49: everything due that day, the week's goals included.
        items: data.items.filter((item) => item.dueDate === day),
      })),
      'By day',
    ),
    sections: [
      summary(data.items),
      section('Week plan', [{ title: null, lines: goalLines(goals), columns: goalColumns }]),
      section('Deliverables', [{ title: null, lines: deliverableLines(deliverables), columns: deliverableColumns }]),
    ],
  };
}

/** Month: the month's goals, then each week — its week plan and its days. */
function monthly(data: PlanExportData): Pick<ReportModel, 'sections' | 'panels'> {
  const goals = data.items.filter((item) => item.horizon === 'month');
  const rest = data.items.filter((item) => item.horizon !== 'month');
  const weekOf = (item: PlanItemRow): IsoDate => (item.horizon === 'week' ? item.periodStart : weekStart(item.dueDate));
  const weeks = [...new Set(rest.map(weekOf))].sort();
  return {
    panels: panels(
      data.items,
      weeks.map((monday) => ({ label: periodLabel('week', monday), items: rest.filter((item) => weekOf(item) === monday) })),
      'By week',
    ),
    sections: [
      summary(data.items),
      section('Month plan', [{ title: null, lines: goalLines(goals), columns: goalColumns }]),
      section(
        'Week by week',
        weeks.map((monday) => ({
          title: periodLabel('week', monday),
          columns: deliverableColumns,
          lines: rest
            .filter((item) => weekOf(item) === monday)
            .sort((a, b) => (a.horizon === b.horizon ? byDue(a, b) : a.horizon === 'week' ? -1 : 1))
            .map((item) => itemLine(item, { When: item.horizon === 'week' ? 'Week' : formatShortDate(item.dueDate), Area: area(item) })),
        })),
      ),
    ],
  };
}

const typeLabels: Readonly<Record<PlanExportKind, string>> = { weekly: 'Weekly plan', monthly: 'Monthly plan' };

export const emptyPlanMessage = 'Nothing planned for this period.';

/** Pure: the plan as a report model. */
export function buildPlanExportModel(data: PlanExportData, today: IsoDate): ReportModel {
  const body = data.items.length === 0 ? { sections: [], panels: [] } : data.kind === 'weekly' ? weekly(data) : monthly(data);
  return {
    kind: data.kind,
    projectName: data.project.name,
    projectSlug: data.project.slug,
    typeLabel: typeLabels[data.kind],
    title: data.kind === 'weekly' ? `Week ${String(isoWeek(data.start))} plan` : `${periodLabel('month', data.start)} plan`,
    panels: body.panels ?? [],
    periodLabel: data.kind === 'weekly' ? periodLabel('week', data.start) : periodLabel('month', data.start),
    periodStart: data.start,
    author: data.author,
    generatedLabel: formatDate(today),
    note: null,
    emptyMessage: emptyPlanMessage,
    sections: body.sections.filter((candidate) => candidate.groups.length > 0 || candidate.summary.length > 0),
  };
}

/** `{project-slug}_plan_{weekly|monthly}_{start}.{ext}` */
export function planFileName(model: ReportModel, extension: 'pdf' | 'md'): string {
  return `${model.projectSlug}_plan_${model.kind}_${model.periodStart}.${extension}`;
}
