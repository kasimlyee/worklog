import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import type { PrState } from '#src/server/db/types.ts';
import { areas, entry, issue, person, planItem, pr, release, reportData } from '#tests/fixtures/report-data.ts';
import { buildReportModel } from './build.ts';
import type { ReportLine, ReportModel } from './model.ts';
import { pdfFallbackCharacter, sanitizeForPdf } from './pdf-sanitize.ts';
import { renderMarkdown } from './render-markdown.ts';
import { reportBlocks } from './render-pdf.ts';

/* docs/04 §4.1 and §4.7: report grouping properties and export fidelity. */

const kinds = ['daily', 'weekly', 'monthly'] as const;
const states: readonly PrState[] = ['open', 'closed', 'merged'];

const anyEntries = fc.array(
  fc.record({
    description: fc.string({ minLength: 1, maxLength: 40 }).filter((text) => text.trim() !== ''),
    area: fc.constantFrom(null, areas.frontend, areas.backend),
    pr: fc.option(fc.record({ number: fc.integer({ min: 1, max: 30 }), state: fc.constantFrom(...states) }), { nil: null }),
    day: fc.integer({ min: 9, max: 15 }),
  }),
  { maxLength: 25 },
);

type Row = {
  readonly description: string;
  readonly area: { readonly id: string } | null;
  readonly pr: { readonly number: number; readonly state: PrState } | null;
  readonly day: number;
};

function entriesFrom(rows: readonly Row[], onlyDay?: number): ReturnType<typeof entry>[] {
  return rows
    .filter((row) => onlyDay === undefined || row.day === onlyDay)
    .sort((a, b) => a.day - b.day)
    .map((row) =>
      entry(row.description, {
        date: `2026-11-${String(row.day).padStart(2, '0')}`,
        area: row.area,
        people: [person('Grace')],
        ...(row.pr === null ? {} : { pr: pr(row.pr.number, row.pr.state, `PR ${String(row.pr.number)}`) }),
      }),
    );
}

function flatten(lines: readonly ReportLine[]): readonly ReportLine[] {
  return lines.flatMap((line) => [line, ...flatten(line.children)]);
}

describe('report grouping properties', () => {
  it('R-05, R-06: every entry of the day appears exactly once in the daily report', () => {
    fc.assert(
      fc.property(anyEntries, (rows) => {
        const entries = entriesFrom(rows, 10);
        const model = buildReportModel(reportData({ kind: 'daily', entries }), d('2026-11-20'));
        const lines = model.sections.find((s) => s.title === 'Work done')?.groups.flatMap((g) => g.lines) ?? [];
        // Daily: a PR line holds its entries as children; any other line is an entry itself.
        const shown = lines.flatMap((line) => (line.tags.length > 0 ? line.children : [line])).map((line) => line.text);
        expect([...shown].sort()).toEqual(entries.map((e) => e.description).sort());
      }),
    );
  });

  it('R-05: areas keep the project order with General last; R-06: PR groups come first, by number', () => {
    fc.assert(
      fc.property(anyEntries, (rows) => {
        const model = buildReportModel(reportData({ kind: 'weekly', entries: entriesFrom(rows) }), d('2026-11-20'));
        const work = model.sections.find((s) => s.title === 'Work done');
        const titles = work?.groups.map((g) => g.title) ?? [];
        const order = ['Frontend', 'Backend', 'General'];
        const areaOrderHolds = titles.every((title, index) => index === 0 || order.indexOf(title ?? '') > order.indexOf(titles[index - 1] ?? ''));
        const prOrderHolds = (work?.groups ?? []).every((group) => {
          const numbers = group.lines.map((line) => /^#(\d+) /.exec(line.text)?.[1]).map((n) => (n === undefined ? Infinity : Number(n)));
          return numbers.every((n, i) => i === 0 || n >= (numbers[i - 1] ?? 0));
        });
        return areaOrderHolds && prOrderHolds;
      }),
    );
  });
});

/** The text a reader sees, in order: headings, item texts and status labels. */
function markdownSequence(model: ReportModel): readonly string[] {
  return renderMarkdown(model)
    .split('\n')
    .flatMap((line) => {
      const labels = [...line.matchAll(/\*\*\[([^\]]+)\]\*\*/g)].map((match) => match[1] ?? '');
      return labels;
    });
}

function pdfSequence(model: ReportModel): readonly string[] {
  return reportBlocks(model).flatMap((block) => block.runs.filter((run) => run.tag !== undefined).map((run) => run.text));
}

function plainTexts(model: ReportModel): readonly string[] {
  return model.sections.flatMap((section) => [section.title, ...section.groups.flatMap((group) => [group.title ?? '', ...flatten(group.lines).map((line) => line.text)])]);
}

describe('export fidelity', () => {
  const fixtures = kinds.map((kind) =>
    buildReportModel(
      reportData({
        kind,
        note: 'Short week.',
        entries: [
          entry('Wired the login form', { area: areas.frontend, pr: pr(12, 'merged', 'Add login') }),
          entry('Hotfix', { date: kind === 'daily' ? '2026-11-10' : '2026-11-14', area: null }),
          entry('Closed experiment', { area: areas.backend, pr: pr(13, 'closed', 'Cache') }),
        ],
        releases: [release('1.4.0', kind === 'daily' ? '2026-11-10' : '2026-11-12', [pr(12, 'merged', 'Add login')])],
        issues: [issue('Crash', '2026-11-09', '2026-11-10'), issue('Open one', '2026-11-03')],
        planItems: [planItem('Ship login', { completedOn: '2026-11-10', horizon: kind === 'monthly' ? 'month' : 'day' })],
        completedItems: kind === 'monthly' ? [planItem('Launch', { completedOn: '2026-11-11', horizon: 'month' })] : [],
      }),
      d('2026-11-20'),
    ),
  );

  it.each(fixtures.map((model) => [model.kind, model] as const))('R-02: %s — PDF and Markdown carry the same status labels in the same order', (_kind, model) => {
    expect(pdfSequence(model)).toEqual(markdownSequence(model));
    expect(pdfSequence(model).length).toBeGreaterThan(0);
  });

  it.each(fixtures.map((model) => [model.kind, model] as const))('R-02: %s — every heading and item text appears in both exports', (_kind, model) => {
    const markdown = renderMarkdown(model).replace(/\\/g, '');
    const pdfText = reportBlocks(model)
      .map((block) => block.runs.map((run) => run.text).join(''))
      .join('\n');
    for (const text of plainTexts(model).filter((t) => t !== '')) {
      expect(markdown, text).toContain(text);
      expect(pdfText, text).toContain(sanitizeForPdf(text));
    }
  });
});

describe('PDF sanitiser properties', () => {
  it('any Unicode string becomes encodable text of the same code-point length, without throwing', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 200 }), (text) => {
        const out = sanitizeForPdf(text);
        return Array.from(out).every((char) => {
          const code = char.codePointAt(0) ?? 0;
          return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.includes(char) || char === pdfFallbackCharacter;
        });
      }),
    );
  });
});
