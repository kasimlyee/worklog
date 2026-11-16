import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import { entry, person, pr, reportData } from '#tests/fixtures/report-data.ts';
import { buildReportModel } from './build.ts';
import { layoutReport } from './pdf-layout.ts';
import { renderPdf, reportFileName } from './render-pdf.ts';

const today = d('2026-11-20');

describe('PDF export', () => {
  it('produces a valid A4 PDF', async () => {
    const model = buildReportModel(reportData({ kind: 'daily', entries: [entry('Fixed login', { pr: pr(1, 'merged') })] }), today);

    const bytes = await renderPdf(model);

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize()).toEqual({ width: 595.28, height: 841.89 });
    expect(doc.getTitle()).toBe('Atlas — Daily report — Tuesday 10 Nov 2026');
  });

  it('spans several pages for a long report', async () => {
    const entries = Array.from({ length: 150 }, (_, i) => entry(`Entry number ${String(i)} with a reasonably long description that wraps`));

    const doc = await PDFDocument.load(await renderPdf(buildReportModel(reportData({ kind: 'daily', entries }), today)));

    expect(doc.getPageCount()).toBeGreaterThan(2);
  });

  it('does not crash on text outside the font, and on an empty report', async () => {
    const model = buildReportModel(
      reportData({ kind: 'daily', note: 'Emoji 😀 and 中文', entries: [entry('Łódź 🚀', { people: [person('Zoë 😀')] })] }),
      today,
    );

    await expect(renderPdf(model)).resolves.toBeInstanceOf(Uint8Array);
    await expect(renderPdf(buildReportModel(reportData({ kind: 'monthly' }), today))).resolves.toBeInstanceOf(Uint8Array);
  });

  it('R-10: status tags are coloured and carry their text label', () => {
    const model = buildReportModel(reportData({ kind: 'daily', entries: [entry('x', { pr: pr(3, 'closed') })] }), today);

    const items = layoutReport(model, (text, _font, size) => text.length * size * 0.5).flatMap((page) => page.items);
    const tagTexts = items.flatMap((item) => (item.type === 'text' && typeof item.colour !== 'string' ? [[item.text, item.colour.tone]] : []));
    const tagBoxes = items.filter((item) => item.type === 'rect' && item.fill !== null && typeof item.fill !== 'string');

    expect(tagTexts).toEqual([['Closed', 'danger']]);
    expect(tagBoxes).toHaveLength(1);
  });

  it('§7.5: names the file {project-slug}_{type}_{period-start}', () => {
    const model = buildReportModel(reportData({ kind: 'weekly' }), today);

    expect(reportFileName(model, 'pdf')).toBe('atlas_weekly_2026-11-09.pdf');
    expect(reportFileName(model, 'md')).toBe('atlas_weekly_2026-11-09.md');
  });
});
