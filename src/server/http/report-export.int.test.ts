import { describe, expect, it } from 'vitest';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import { testDb } from '#tests/setup/test-db.ts';
import { aPerson, aProject, anEntry, withPeople } from '#tests/fixtures/builders.ts';
import { exportReport, type ExportDeps } from './report-export.ts';

async function deps(overrides: Partial<ExportDeps> = {}): Promise<ExportDeps> {
  const project = await aProject(testDb(), { name: 'Atlas', slug: 'atlas' });
  return { db: testDb(), isSignedIn: true, projectId: project.id, today: d('2026-11-20'), author: 'Kasim', ...overrides };
}

const request = (query: string): Request => new Request(`https://worklog.example.com/projects/x/reports/export?${query}`);

describe('report export', () => {
  it('NF-05: requires a session', async () => {
    const response = await exportReport(request('kind=daily&start=2026-11-10&format=md'), await deps({ isSignedIn: false }));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/sign-in');
  });

  it('downloads Markdown with file name and no caching', async () => {
    const context = await deps();
    const entry = await anEntry(testDb(), context.projectId, { workDate: '2026-11-10', description: 'Fixed login' });
    await withPeople(testDb(), 'entryPeople', entry.id, [(await aPerson(testDb(), { name: 'Grace' })).id]);

    const response = await exportReport(request('kind=daily&start=2026-11-10&format=md'), context);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="atlas_daily_2026-11-10.md"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toContain('- Fixed login — Grace');
  });

  it('downloads a PDF', async () => {
    const response = await exportReport(request('kind=monthly&start=2026-11-01&format=pdf'), await deps());

    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="atlas_monthly_2026-11-01.pdf"');
    expect(new TextDecoder().decode((await response.arrayBuffer()).slice(0, 5))).toBe('%PDF-');
  });

  it.each([
    'kind=weekly&start=2026-11-10&format=pdf',
    'kind=monthly&start=2026-11-02&format=md',
    'kind=yearly&start=2026-11-01&format=md',
    'kind=daily&start=2026-02-30&format=md',
    'kind=daily&start=2026-11-10&format=docx',
    'kind=daily&start=2026-11-10',
    '',
  ])('rejects invalid input: %s', async (query) => {
    expect((await exportReport(request(query), await deps())).status).toBe(400);
  });

  it('returns 404 for an unknown project', async () => {
    const response = await exportReport(request('kind=daily&start=2026-11-10&format=md'), await deps({ projectId: '00000000-0000-4000-8000-000000000000' }));

    expect(response.status).toBe(404);
  });
});
