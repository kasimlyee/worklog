import { itemLabelFor, tableOf, type TableCell } from '#src/lib/report-table.ts';
import { emptyReportMessage, type ReportGroup, type ReportModel, type StatusTag } from './model.ts';

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

function cellText(cell: TableCell): string {
  switch (cell.kind) {
    case 'text':
      return cell.sub === null ? escapeMarkdown(cell.text) : `${escapeMarkdown(cell.text)} _(${escapeMarkdown(cell.sub)})_`;
    case 'tags':
      return cell.tags.map(tag).join(' ');
    case 'plain':
      return escapeMarkdown(cell.text);
    default:
      return cell satisfies never;
  }
}

/** A GFM table; a nested row (an entry under its PR, a cause under its issue) starts with ↳. */
function renderTable(group: ReportGroup, itemLabel: string): readonly string[] {
  const table = tableOf(group, itemLabel);
  const row = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;
  return [
    row(table.columns.map((column) => escapeMarkdown(column.label))),
    row(table.columns.map(() => '---')),
    ...table.rows.map((tableRow) =>
      row(tableRow.cells.map((cell) => (cell.kind === 'text' && tableRow.depth > 0 ? `↳ ${cellText(cell)}` : cellText(cell)))),
    ),
  ];
}

/** CommonMark (with GFM tables) export of the report model (R-02, §7.5). */
export function renderMarkdown(model: ReportModel): string {
  const out: string[] = [
    `# ${escapeMarkdown(model.projectName)} — ${escapeMarkdown(model.title ?? model.typeLabel)}`,
    '',
    `**${escapeMarkdown(model.periodLabel)}** · ${model.typeLabel} · Prepared by ${escapeMarkdown(model.author)} · Generated ${model.generatedLabel}`,
  ];
  if (model.note !== null) {
    out.push('', ...model.note.split(/\r?\n/).map((noteLine) => `> ${escapeMarkdown(noteLine)}`.trimEnd()));
  }
  if (model.sections.length === 0) {
    out.push('', model.emptyMessage ?? emptyReportMessage);
  }
  const [first, ...rest] = model.sections;
  // The key numbers lead, then the boxes, then every other section.
  const lead = first?.title === 'Summary' ? first : null;
  if (lead !== null) {
    out.push('', `## ${lead.title}`, '', `| ${lead.summary.map((item) => item.label).join(' | ')} |`, `| ${lead.summary.map(() => '---').join(' | ')} |`, `| ${lead.summary.map((item) => `**${String(item.value)}**`).join(' | ')} |`);
  }
  for (const panel of model.panels ?? []) {
    out.push('', `**${escapeMarkdown(panel.title)}**`, '', ...panel.items.map((item) => `- ${escapeMarkdown(item)}`));
  }
  for (const section of lead === null ? model.sections : rest) {
    out.push('', `## ${section.title}`);
    if (section.summary.length > 0) {
      out.push('', section.summary.map((item) => `${item.label}: **${String(item.value)}**`).join(' · '));
    }
    for (const group of section.groups) {
      out.push('');
      if (group.title !== null) {
        out.push(`### ${escapeMarkdown(group.title)}`, '');
      }
      out.push(...renderTable(group, itemLabelFor(section.title, group.title)));
    }
  }
  return `${out.join('\n')}\n`;
}
