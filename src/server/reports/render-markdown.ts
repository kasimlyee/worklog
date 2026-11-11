import { emptyReportMessage, type ReportLine, type ReportModel, type StatusTag } from './model.ts';

/** User text as literal Markdown: one line, with every character CommonMark gives meaning escaped. */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\\`*_[\]{}()<>#!|~]/g, '\\$&')
    // Only at the start of a line do these begin a list.
    .replace(/^(\d+)([.)])(?=\s|$)/, '$1\\$2')
    .replace(/^([-+])(?=\s|$)/, '\\$1');
}

/** §7.5: colours appear as text labels only, e.g. **[Merged]**. */
function tag(status: StatusTag): string {
  return `**[${escapeMarkdown(status.label)}]**`;
}

function renderLine(item: ReportLine, depth: number): readonly string[] {
  const parts = [escapeMarkdown(item.text), ...item.tags.map(tag)];
  if (item.detail !== null) {
    parts.push(`_(${escapeMarkdown(item.detail)})_`);
  }
  if (item.people.length > 0) {
    parts.push(`— ${escapeMarkdown(item.people.join(', '))}`);
  }
  const indent = '  '.repeat(depth);
  return [`${indent}- ${parts.join(' ')}`, ...item.children.flatMap((child) => renderLine(child, depth + 1))];
}

/** CommonMark export of the report model (R-02, §7.5). */
export function renderMarkdown(model: ReportModel): string {
  const out: string[] = [
    `# ${escapeMarkdown(model.projectName)} — ${model.typeLabel}`,
    '',
    `**${escapeMarkdown(model.periodLabel)}** · Prepared by ${escapeMarkdown(model.author)} · Generated ${model.generatedLabel}`,
  ];
  if (model.note !== null) {
    out.push('', ...model.note.split(/\r?\n/).map((noteLine) => `> ${escapeMarkdown(noteLine)}`.trimEnd()));
  }
  if (model.sections.length === 0) {
    out.push('', emptyReportMessage);
  }
  for (const section of model.sections) {
    out.push('', `## ${section.title}`);
    if (section.summary.length > 0) {
      out.push('', section.summary.map((item) => `${item.label}: **${String(item.value)}**`).join(' · '));
    }
    for (const group of section.groups) {
      out.push('');
      if (group.title !== null) {
        out.push(`### ${escapeMarkdown(group.title)}`, '');
      }
      out.push(...group.lines.flatMap((item) => renderLine(item, 0)));
    }
  }
  return `${out.join('\n')}\n`;
}
