import 'server-only';
import * as z from 'zod';
import { err, ok, type Result } from '#src/lib/result.ts';
import type { Db } from '#src/server/db/client.ts';
import type { PlanItemStatus } from '#src/server/db/types.ts';
import { addDays, dayLabel, formatDate, formatShortDate, monthEnd, parseIsoDate, weekday, weekStart, type IsoDate } from '#src/server/domain/calendar.ts';
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

const horizonNames: Readonly<Record<PlanItemRow['horizon'], string>> = { day: 'Day plan', week: 'Week plan', month: 'Month plan' };

function itemLine(item: PlanItemRow, detail: readonly (string | null)[]): ReportLine {
  const parts = detail.filter((part): part is string => part !== null && part !== '');
  return {
    text: item.title,
    tags: [statusTags[item.status]],
    detail: parts.length === 0 ? null : parts.join(' · '),
    people: item.assignees.map((person) => person.name),
    children: [],
  };
}

/** Grouped by area, in the order the plan lists them; "General" last. */
function byArea(items: readonly PlanItemRow[], detail: (item: PlanItemRow) => readonly (string | null)[]): readonly ReportGroup[] {
  const groups = new Map<string, PlanItemRow[]>();
  for (const item of items) {
    const key = item.areaName ?? '';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
    .map(([area, rows]) => ({ title: area === '' ? 'General' : area, lines: rows.map((row) => itemLine(row, detail(row))) }));
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

/** Week: the week plan by area, then every other item day by day, Monday to Sunday. */
function weeklySections(data: PlanExportData): readonly ReportSection[] {
  const weekItems = data.items.filter((item) => item.horizon === 'week' && item.periodStart === data.start);
  const others = data.items.filter((item) => !weekItems.includes(item));
  const days = Array.from({ length: 7 }, (_, index) => addDays(data.start, index));
  return [
    summary(data.items),
    section('Week plan', byArea(weekItems, (item) => [`Due ${formatShortDate(item.dueDate)}`])),
    section(
      'Day by day',
      days.map((day) => ({
        title: dayLabel(day),
        lines: others
          .filter((item) => item.dueDate === day)
          .map((item) => itemLine(item, [item.areaName, item.horizon === 'day' ? null : horizonNames[item.horizon]])),
      })),
    ),
  ];
}

/** Month: the month plan by area, then each week — its week plan, then its days. */
function monthlySections(data: PlanExportData): readonly ReportSection[] {
  const monthItems = data.items.filter((item) => item.horizon === 'month');
  const rest = data.items.filter((item) => item.horizon !== 'month');
  const weeks = [...new Set(rest.map((item) => (item.horizon === 'week' ? item.periodStart : weekStart(item.dueDate))))].sort();
  return [
    summary(data.items),
    section('Month plan', byArea(monthItems, (item) => [`Due ${formatShortDate(item.dueDate)}`])),
    section(
      'Week by week',
      weeks.map((monday) => ({
        title: periodLabel('week', monday),
        lines: rest
          .filter((item) => (item.horizon === 'week' ? item.periodStart : weekStart(item.dueDate)) === monday)
          .sort((a, b) => (a.horizon === b.horizon ? (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0) : a.horizon === 'week' ? -1 : 1))
          .map((item) =>
            itemLine(item, [item.areaName, item.horizon === 'week' ? 'Week plan' : formatShortDate(item.dueDate)]),
          ),
      })),
    ),
  ];
}

const typeLabels: Readonly<Record<PlanExportKind, string>> = { weekly: 'Weekly plan', monthly: 'Monthly plan' };

export const emptyPlanMessage = 'Nothing planned for this period.';

/** Pure: the plan as a report model. */
export function buildPlanExportModel(data: PlanExportData, today: IsoDate): ReportModel {
  const sections = data.items.length === 0 ? [] : data.kind === 'weekly' ? weeklySections(data) : monthlySections(data);
  return {
    kind: data.kind,
    projectName: data.project.name,
    projectSlug: data.project.slug,
    typeLabel: typeLabels[data.kind],
    periodLabel: data.kind === 'weekly' ? periodLabel('week', data.start) : periodLabel('month', data.start),
    periodStart: data.start,
    author: data.author,
    generatedLabel: formatDate(today),
    note: null,
    emptyMessage: emptyPlanMessage,
    sections: sections.filter((candidate) => candidate.groups.length > 0 || candidate.summary.length > 0),
  };
}

/** `{project-slug}_plan_{weekly|monthly}_{start}.{ext}` */
export function planFileName(model: ReportModel, extension: 'pdf' | 'md'): string {
  return `${model.projectSlug}_plan_${model.kind}_${model.periodStart}.${extension}`;
}
