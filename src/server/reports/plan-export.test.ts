import { describe, expect, it } from 'vitest';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import type { PlanItemRow } from '#src/server/repositories/plans.ts';
import { buildPlanExportModel, emptyPlanMessage, parsePlanExportRequest, planFileName, type PlanExportData } from './plan-export.ts';
import { renderMarkdown } from './render-markdown.ts';

let next = 0;
function item(title: string, horizon: PlanItemRow['horizon'], periodStart: string, due: string, extra: Partial<PlanItemRow> = {}): PlanItemRow {
  next += 1;
  return {
    id: `i${String(next)}`,
    planId: `${horizon}-${periodStart}`,
    horizon,
    periodStart: d(periodStart),
    title,
    description: '',
    status: 'planned',
    dueDate: d(due),
    completedOn: null,
    position: next,
    areaId: null,
    areaName: null,
    issueId: null,
    issueTitle: null,
    assignees: [],
    moves: [],
    ...extra,
  };
}

const today = d('2026-11-16');
const data = (kind: PlanExportData['kind'], start: string, items: readonly PlanItemRow[]): PlanExportData => ({
  kind,
  start: d(start),
  project: { name: 'Nestly', slug: 'nestly' },
  author: 'Kasim',
  items,
});

describe('plan export', () => {
  it('BR-47: a weekly plan: key numbers, by area and by day, the week plan, then every deliverable Monday to Sunday', () => {
    const model = buildPlanExportModel(
      data('weekly', '2026-11-16', [
        item('Similar houses', 'day', '2026-11-16', '2026-11-16', { description: 'catch mixed interiors', areaName: 'Nestly', assignees: [{ id: 'p', name: 'Kasim Lyee' }], status: 'done' }),
        item('Roofs backend', 'day', '2026-11-17', '2026-11-17', { areaName: 'Roofs' }),
        item('Test Roofs (Admin)', 'month', '2026-11-01', '2026-11-21', { areaName: 'Roofs' }),
        item('Broker acquisition', 'week', '2026-11-16', '2026-11-20', { areaName: 'Nestly', status: 'in_progress' }),
      ]),
      today,
    );

    expect([model.typeLabel, model.title, model.periodLabel]).toEqual(['Weekly plan', 'Week 47 plan', 'Week of 16–20 Nov 2026']);
    expect(model.sections.map((s) => s.title)).toEqual(['Summary', 'Week plan', 'Deliverables']);
    expect(model.sections[0]?.summary.map((s) => [s.label, s.value])).toEqual([
      ['Planned items', 4], ['Done', 1], ['In progress', 1], ['Blocked', 0], ['Not started', 2],
    ]);
    expect(model.panels).toEqual([
      { title: 'By area', items: ['Nestly: 2 items, 1 done', 'Roofs: 2 items, 0 done'] },
      { title: 'By day', items: ['Mon 16 Nov: 1 item, 1 done', 'Tue 17 Nov: 1 item, 0 done', 'Sat 21 Nov: 1 item, 0 done'] },
    ]);
    const goals = model.sections[1]?.groups[0]?.lines ?? [];
    expect(goals.map((l) => [l.text, l.cells?.map((c) => c.text), l.tags[0]?.label])).toEqual([['Broker acquisition', ['Nestly', 'Fri 20 Nov'], 'In progress']]);
    const deliverables = model.sections[2]?.groups[0]?.lines ?? [];
    expect(deliverables.map((l) => [l.cells?.[0]?.text, l.text, l.detail])).toEqual([
      ['Mon 16 Nov', 'Similar houses', 'catch mixed interiors'],
      ['Tue 17 Nov', 'Roofs backend', null],
      ['Sat 21 Nov', 'Test Roofs (Admin)', null],
    ]);
    expect(deliverables[0]?.people).toEqual(['Kasim Lyee']);
    expect(planFileName(model, 'pdf')).toBe('nestly_plan_weekly_2026-11-16.pdf');
  });

  it('BR-47: a monthly plan: the month plan, then each week — its week plan first, then its days', () => {
    const model = buildPlanExportModel(
      data('monthly', '2026-11-01', [
        item('Roofs launch', 'month', '2026-11-01', '2026-11-30', { areaName: 'Roofs' }),
        item('Email provider', 'month', '2026-11-01', '2026-11-30'),
        item('Day work', 'day', '2026-11-17', '2026-11-17'),
        item('Week work', 'week', '2026-11-16', '2026-11-20'),
        item('Earlier week', 'week', '2026-11-09', '2026-11-13'),
      ]),
      today,
    );

    expect(model.title).toBe('November 2026 plan');
    expect(model.sections[1]?.groups[0]?.lines.map((l) => [l.text, l.cells?.[0]?.text])).toEqual([
      ['Roofs launch', 'Roofs'],
      ['Email provider', 'General'],
    ]);
    expect(model.sections[2]?.groups.map((g) => [g.title, g.lines.map((l) => [l.cells?.[0]?.text, l.text])])).toEqual([
      ['Week of 9–13 Nov 2026', [['Week', 'Earlier week']]],
      ['Week of 16–20 Nov 2026', [['Week', 'Week work'], ['Tue 17 Nov', 'Day work']]],
    ]);
  });

  it('BR-47: an empty period says nothing is planned, not that no work was recorded', () => {
    const model = buildPlanExportModel(data('weekly', '2026-11-23', []), today);

    expect(model.sections).toEqual([]);
    expect(renderMarkdown(model)).toContain(emptyPlanMessage);
  });

  it('BR-47: only weekly from a Monday or monthly from the 1st', () => {
    expect(parsePlanExportRequest({ kind: 'weekly', start: '2026-11-16' }).ok).toBe(true);
    expect(parsePlanExportRequest({ kind: 'monthly', start: '2026-11-01' }).ok).toBe(true);
    expect(parsePlanExportRequest({ kind: 'weekly', start: '2026-11-17' }).ok).toBe(false);
    expect(parsePlanExportRequest({ kind: 'monthly', start: '2026-11-02' }).ok).toBe(false);
    expect(parsePlanExportRequest({ kind: 'daily', start: '2026-11-16' }).ok).toBe(false);
    expect(parsePlanExportRequest({ kind: 'weekly', start: 'x' }).ok).toBe(false);
  });
});
