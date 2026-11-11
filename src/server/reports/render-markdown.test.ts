import { describe, expect, it } from 'vitest';
import { isoDate as d } from '#src/server/domain/calendar.ts';
import { areas, entry, issue, person, planItem, pr, release, reportData } from '#tests/fixtures/report-data.ts';
import { buildReportModel } from './build.ts';
import { escapeMarkdown, renderMarkdown } from './render-markdown.ts';

const today = d('2026-11-20');

describe('Markdown export', () => {
  it('R-02: renders a full weekly report (snapshot)', () => {
    const data = reportData({
      kind: 'weekly',
      note: 'Short week.\nPublic holiday on Friday.',
      entries: [
        entry('Wired the login form', { area: areas.frontend, pr: pr(12, 'merged', 'Add login'), people: [person('Ali'), person('Grace')] }),
        entry('Styled errors', { area: areas.frontend, pr: pr(12, 'merged', 'Add login') }),
        entry('Hotfix on Saturday', { date: '2026-11-14', area: areas.backend }),
      ],
      releases: [release('1.4.0', '2026-11-12', [pr(12, 'merged', 'Add login')])],
      issues: [issue('Crash on save', '2026-11-10', '2026-11-12')],
      planItems: [planItem('Ship login', { horizon: 'week', due: '2026-11-13', completedOn: '2026-11-12' })],
    });

    expect(renderMarkdown(buildReportModel(data, today))).toMatchSnapshot();
  });

  it('R-08: an empty report still exports with the no-work message', () => {
    const markdown = renderMarkdown(buildReportModel(reportData({ kind: 'daily' }), today));

    expect(markdown).toBe('# Atlas — Daily report\n\n**Tuesday 10 Nov 2026** · Prepared by Kasim · Generated 20 Nov 2026\n\nNo work recorded for this period.\n');
  });

  it('R-10: status appears as a bold text label', () => {
    const markdown = renderMarkdown(buildReportModel(reportData({ kind: 'daily', entries: [entry('x', { pr: pr(1, 'closed') })] }), today));

    expect(markdown).toContain('- \\#1 PR 1 **[Closed]**');
  });

  it('escapes Markdown and HTML in user text so it stays literal', () => {
    expect(escapeMarkdown('<script>alert(1)</script> *bold* [x](javascript:y) # h | `c`')).toBe(
      '\\<script\\>alert\\(1\\)\\</script\\> \\*bold\\* \\[x\\]\\(javascript:y\\) \\# h \\| \\`c\\`',
    );
    expect(escapeMarkdown('1. not a list')).toBe('1\\. not a list');
    expect(escapeMarkdown('- not a list')).toBe('\\- not a list');
    expect(escapeMarkdown('+ not a list')).toBe('\\+ not a list');
    expect(escapeMarkdown('1.4.0 and C++ and a-b')).toBe('1.4.0 and C++ and a-b');
    expect(escapeMarkdown('two\nlines')).toBe('two lines');
  });
});
