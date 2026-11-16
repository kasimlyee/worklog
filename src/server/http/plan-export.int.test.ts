import { describe, expect, it } from 'vitest';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import { countQueries, testDb } from '#tests/setup/test-db.ts';
import { aPerson, aPlan, aPlanItem, aProject, aProject as another, withPeople } from '#tests/fixtures/builders.ts';
import { exportPlan } from './plan-export.ts';
import type { ExportDeps } from './report-export.ts';

async function deps(overrides: Partial<ExportDeps> = {}): Promise<ExportDeps> {
  const project = await aProject(testDb(), { name: 'Nestly', slug: 'nestly' });
  return { db: testDb(), isSignedIn: true, projectId: project.id, today: d('2026-11-16'), author: 'Kasim', ...overrides };
}

const request = (query: string): Request => new Request(`https://worklog.example.com/projects/x/plans/export?${query}`);

describe('plan export', () => {
  it('NF-05: requires a session', async () => {
    const response = await exportPlan(request('kind=weekly&start=2026-11-16&format=md'), await deps({ isSignedIn: false }));

    expect([response.status, response.headers.get('location')]).toEqual([303, '/sign-in']);
  });

  it('BR-47: downloads the week plan as Markdown — this project only, weekend items included, in two queries', async () => {
    const context = await deps();
    const grace = await aPerson(testDb(), { name: 'Grace' });
    const monday = await aPlanItem(testDb(), await aPlan(testDb(), context.projectId, { horizon: 'day', periodStart: '2026-11-16' }), { title: 'Drafts for admins' });
    await withPeople(testDb(), 'planItemAssignees', monday.id, [grace.id]);
    await aPlanItem(testDb(), await aPlan(testDb(), context.projectId, { horizon: 'month', periodStart: '2026-11-01' }), { title: 'Retest and release', dueDate: '2026-11-22' });
    await aPlanItem(testDb(), await aPlan(testDb(), context.projectId, { horizon: 'day', periodStart: '2026-11-23' }), { title: 'next week' });
    const other = await another(testDb());
    await aPlanItem(testDb(), await aPlan(testDb(), other.id, { horizon: 'day', periodStart: '2026-11-16' }), { title: 'other project' });

    let response: Response | undefined;
    const queries = await countQueries(async () => {
      response = await exportPlan(request('kind=weekly&start=2026-11-16&format=md'), context);
    });
    const text = (await response?.text()) ?? '';

    expect(response?.status).toBe(200);
    expect(response?.headers.get('content-disposition')).toBe('attachment; filename="nestly_plan_weekly_2026-11-16.md"');
    expect(response?.headers.get('cache-control')).toBe('no-store');
    expect(text).toContain('# Nestly — Week 47 plan');
    expect(text).toContain('Drafts for admins');
    expect(text).toContain('Grace');
    expect(text).toContain('| Sun 22 Nov | Retest and release |');
    expect(text).not.toContain('next week');
    expect(text).not.toContain('other project');
    expect(queries).toBe(2);
  });

  it('BR-47: downloads the month plan as a PDF', async () => {
    const response = await exportPlan(request('kind=monthly&start=2026-11-01&format=pdf'), await deps());

    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="nestly_plan_monthly_2026-11-01.pdf"');
    expect(new TextDecoder().decode((await response.arrayBuffer()).slice(0, 5))).toBe('%PDF-');
  });

  it('refuses a bad request and an unknown project', async () => {
    const context = await deps();

    expect((await exportPlan(request('kind=weekly&start=2026-11-17&format=md'), context)).status).toBe(400);
    expect((await exportPlan(request('kind=weekly&start=2026-11-16&format=docx'), context)).status).toBe(400);
    expect((await exportPlan(request('kind=weekly&start=2026-11-16&format=md'), { ...context, projectId: '00000000-0000-4000-8000-000000000000' })).status).toBe(404);
  });
});
