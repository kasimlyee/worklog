import { describe, expect, it } from 'vitest';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import { entry, issue, person, pr, reportData } from '#tests/fixtures/report-data.ts';
import { buildReportModel } from './build.ts';
import { a4, layoutReport, layoutText, wrapText, type Item, type Measure } from './pdf-layout.ts';

/* D-19: the status-report layout — band, tiles, boxes, tables — tested without pdf-lib. */

const measure: Measure = (text, _font, size) => text.length * size * 0.5;
const today = d('2026-11-20');
const texts = (items: readonly Item[]): readonly string[] => items.flatMap((item) => (item.type === 'text' ? [item.text] : []));

describe('PDF layout', () => {
  it('wraps words to the width and splits a word longer than a line', () => {
    expect(wrapText('aaaa bbbb cccc', 'regular', 10, 40, measure)).toEqual(['aaaa', 'bbbb', 'cccc']);
    expect(wrapText('aaaa bbbb cccc', 'regular', 10, 50, measure)).toEqual(['aaaa bbbb', 'cccc']);
    expect(wrapText('abcdefghijkl', 'regular', 10, 50, measure)).toEqual(['abcdefghij', 'kl']);
    expect(wrapText('', 'regular', 10, 50, measure)).toEqual(['']);
  });

  it('opens with a dark title band naming the project, title, period and author', () => {
    const model = buildReportModel(reportData({ kind: 'weekly', entries: [entry('Fixed login')] }), today);
    const [first] = layoutReport(model, measure);

    expect(first?.items[0]).toMatchObject({ type: 'rect', x: 0, top: 0, width: a4.width, fill: 'navy' });
    expect(texts(first?.items ?? [])).toEqual(expect.arrayContaining(['WEEKLY REPORT · ATLAS', 'Week 46 report', 'Week of 9–13 Nov 2026', 'Prepared by Kasim']));
  });

  it('draws the summary as tiles and every group as a table with column headings', () => {
    const model = buildReportModel(
      reportData({ kind: 'weekly', entries: [entry('Fixed login', { pr: pr(12, 'merged'), people: [person('Grace')] })], issues: [issue('Crash', '2026-11-13', '2026-11-12')] }),
      today,
    );
    const all = texts(layoutReport(model, measure).flatMap((page) => page.items));

    expect(all).toEqual(expect.arrayContaining(['ENTRIES', 'ISSUE', 'DEADLINE', 'RESOLVED', 'STATUS']));
    expect(all).toContain('Merged');
  });

  it('repeats the column headings when a table continues on a new page, and numbers every page', () => {
    const entries = Array.from({ length: 120 }, (_, i) => entry(`Entry number ${String(i)} with a reasonably long description that wraps`));
    const pages = layoutReport(buildReportModel(reportData({ kind: 'daily', entries }), today), measure);

    expect(pages.length).toBeGreaterThan(2);
    for (const [index, page] of pages.entries()) {
      expect(texts(page.items)).toContain(`Page ${String(index + 1)} of ${String(pages.length)}`);
    }
    // After the "continued" line, each later page starts with the table's column headings.
    for (const page of pages.slice(1)) {
      const [continued, heading] = texts(page.items);
      expect(continued).toBe('Atlas · Daily report · continued');
      expect(heading).toMatch(/^[A-Z ]+$/);
    }
  });

  it('keeps everything inside the page margins', () => {
    const entries = Array.from({ length: 60 }, (_, i) => entry(`Entry ${String(i)} ${'word '.repeat(30)}`));
    for (const page of layoutReport(buildReportModel(reportData({ kind: 'daily', entries }), today), measure)) {
      for (const item of page.items) {
        if (item.type === 'text' && !(item.top < 100 && item.colour === 'white')) {
          expect(item.top).toBeLessThanOrEqual(a4.height - 10);
        }
      }
    }
  });

  it('an empty report shows its message on one page', () => {
    const pages = layoutReport(buildReportModel(reportData({ kind: 'daily' }), today), measure);

    expect(pages).toHaveLength(1);
    expect(layoutText(pages)).toContain('No work recorded for this period.');
  });
});
