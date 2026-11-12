import { isoDate, type IsoDate } from '#src/server/domain/calendar.ts';
import type { EntryRow, NamedRef } from '#src/server/repositories/entries.ts';
import type { ReleaseRow } from '#src/server/repositories/releases.ts';
import type { ReportIssueRow, ReportPlanItemRow } from '#src/server/repositories/reports.ts';
import type { ReportData } from '#src/server/reports/load.ts';
import type { PrState } from '#src/server/db/types.ts';

/* In-memory report data for pure builder and renderer tests. */

let sequence = 0;
const nextId = (): string => {
  sequence += 1;
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
};

export const person = (name: string): NamedRef => ({ id: `p-${name}`, name });

export const areas = {
  frontend: { id: 'area-frontend', name: 'Frontend' },
  backend: { id: 'area-backend', name: 'Backend' },
} as const;

type EntryOptions = {
  readonly date?: string;
  readonly area?: { readonly id: string } | null;
  readonly people?: readonly NamedRef[];
  readonly pr?: { readonly id: string; readonly number: number; readonly title: string; readonly state: PrState; readonly repo?: string };
  readonly planItemIds?: readonly string[];
  readonly createdAt?: string;
};

export function entry(description: string, options: EntryOptions = {}): EntryRow {
  const { pr } = options;
  return {
    id: nextId(),
    workDate: isoDate(options.date ?? '2026-11-10'),
    description,
    createdAt: options.createdAt ?? '2026-11-10 08:00:00+00',
    areaId: options.area?.id ?? null,
    areaName: null,
    pullRequestId: pr?.id ?? null,
    prOwner: pr === undefined ? null : 'acme',
    prRepo: pr === undefined ? null : (pr.repo ?? 'app'),
    prNumber: pr?.number ?? null,
    prTitle: pr?.title ?? null,
    prState: pr?.state ?? null,
    planItems: (options.planItemIds ?? []).map((id) => ({ id, title: `Plan item ${id}` })),
    issues: [],
    people: options.people ?? [person('Grace')],
  };
}

export type PrFixture = { readonly id: string; readonly number: number; readonly title: string; readonly state: PrState };

export function pr(number: number, state: PrState = 'open', title = `PR ${String(number)}`): PrFixture {
  return { id: `pr-${String(number)}`, number, title, state };
}

export function issue(
  title: string,
  deadline: string,
  resolvedOn: string | null = null,
  assignees = [person('Grace')],
  priority: ReportIssueRow['priority'] = 'medium',
  extra: { readonly assignedOn?: string; readonly resolvedBy?: PrFixture } = {},
): ReportIssueRow {
  return {
    id: nextId(),
    title,
    priority,
    // Assigned before the fixture periods unless a test says otherwise.
    assignedOn: isoDate(extra.assignedOn ?? '2026-10-01'),
    deadline: isoDate(deadline),
    resolvedOn: resolvedOn === null ? null : isoDate(resolvedOn),
    resolvedByNumber: extra.resolvedBy?.number ?? null,
    resolvedByTitle: extra.resolvedBy?.title ?? null,
    assignees,
  };
}

export function planItem(
  title: string,
  options: { readonly due?: string; readonly completedOn?: string | null; readonly horizon?: 'day' | 'week' | 'month'; readonly assignees?: readonly NamedRef[] } = {},
): ReportPlanItemRow {
  const completedOn = options.completedOn ?? null;
  return {
    id: nextId(),
    title,
    status: completedOn === null ? 'planned' : 'done',
    dueDate: isoDate(options.due ?? '2026-11-10'),
    completedOn: completedOn === null ? null : isoDate(completedOn),
    horizon: options.horizon ?? 'day',
    assignees: options.assignees ?? [person('Ali')],
  };
}

export function release(version: string, releasedOn: string, prs: readonly PrFixture[] = []): ReleaseRow {
  return {
    id: nextId(),
    version,
    status: 'released',
    targetDate: null,
    releasedOn: isoDate(releasedOn),
    notes: '',
    pullRequests: prs.map((p) => ({ id: p.id, owner: 'acme', repo: 'app', number: p.number, title: p.title, state: p.state })),
  };
}

export function reportData(overrides: Partial<ReportData> & Pick<ReportData, 'kind'>): ReportData {
  const start: IsoDate = overrides.start ?? isoDate(overrides.kind === 'monthly' ? '2026-11-01' : overrides.kind === 'weekly' ? '2026-11-09' : '2026-11-10');
  const to = overrides.kind === 'daily' ? start : isoDate(overrides.kind === 'weekly' ? '2026-11-15' : '2026-11-30');
  return {
    start,
    range: { from: start, to },
    asOf: to,
    project: { name: 'Atlas', slug: 'atlas' },
    author: 'Kasim',
    note: '',
    areas: [areas.frontend, areas.backend],
    entries: [],
    releases: [],
    issues: [],
    planItems: [],
    moves: [],
    overdueItems: [],
    completedItems: [],
    ...overrides,
  };
}
