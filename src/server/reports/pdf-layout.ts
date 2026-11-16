import { itemLabelFor, tableOf, type TableCell } from '#src/lib/report-table.ts';
import { emptyReportMessage, type ReportGroup, type ReportModel, type ReportPanel, type ReportSection, type Tone } from './model.ts';
import { sanitizeForPdf } from './pdf-sanitize.ts';

/*
 * D-19: the report and plan PDF as a status-report document — a dark title band, the key
 * numbers as tiles, two boxes, then tables. Pure: text widths come from an injected
 * `measure`, so the layout is tested without pdf-lib. Coordinates are measured from the
 * top of the page here and flipped when drawn.
 */

export type FontKey = 'regular' | 'bold' | 'italic';
export type Colour = 'ink' | 'ink2' | 'muted' | 'navy' | 'white' | 'bandMuted' | 'rule' | 'tile' | 'note';

export type TextItem = {
  readonly type: 'text';
  readonly x: number;
  /** Baseline, from the top of the page. */
  readonly top: number;
  readonly text: string;
  readonly font: FontKey;
  readonly size: number;
  readonly colour: Colour | { readonly tone: Tone };
  /** Wrapped pieces of one piece of text share a key, so tests can join them back. */
  readonly key: string;
};
export type RectItem = {
  readonly type: 'rect';
  readonly x: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly fill: Colour | { readonly tone: Tone } | null;
  readonly stroke?: Colour;
};
export type LineItem = { readonly type: 'line'; readonly x1: number; readonly x2: number; readonly top: number; readonly colour: Colour; readonly width: number };
export type Item = TextItem | RectItem | LineItem;
export type PageLayout = { readonly items: readonly Item[] };

export type Measure = (text: string, font: FontKey, size: number) => number;

/** A4 portrait in points (§7.5). */
export const a4 = { width: 595.28, height: 841.89, side: 40, top: 36, bottom: 52 } as const;
const contentWidth = a4.width - 2 * a4.side;

const tagSize = 7.2;
const tagPad = 3.5;
const tagHeight = 11;
const cellPadX = 5;
const cellPadY = 5;

/** Word wrap; a word wider than the line is split. Always at least one line. */
export function wrapText(text: string, font: FontKey, size: number, width: number, measure: Measure): readonly string[] {
  const words = text.split(/\s+/).filter((word) => word !== '');
  const lines: string[] = [];
  let current = '';
  const push = (word: string): void => {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (measure(candidate, font, size) <= width || current === '') {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  };
  for (const word of words) {
    if (measure(word, font, size) <= width) {
      push(word);
      continue;
    }
    let chunk = '';
    for (const char of word) {
      if (chunk !== '' && measure(chunk + char, font, size) > width) {
        push(chunk);
        chunk = '';
      }
      chunk += char;
    }
    push(chunk);
  }
  if (current !== '' || lines.length === 0) {
    lines.push(current);
  }
  return lines;
}

const tagWidth = (label: string, measure: Measure): number => measure(label, 'bold', tagSize) + 2 * tagPad;

/** Lays out the whole document. Always returns at least one page. */
export function layoutReport(raw: ReportModel, measure: Measure): readonly PageLayout[] {
  const model = clean(raw);
  const pages: Item[][] = [[]];
  let y = 0;
  let keySeq = 0;
  const key = (): string => {
    keySeq += 1;
    return `k${String(keySeq)}`;
  };
  const items = (): Item[] => pages[pages.length - 1] ?? [];
  const text = (x: number, top: number, value: string, font: FontKey, size: number, colour: TextItem['colour'], k = key()): void => {
    items().push({ type: 'text', x, top, text: value, font, size, colour, key: k });
  };
  const bottomLimit = a4.height - a4.bottom;
  const newPage = (): void => {
    pages.push([]);
    y = a4.top;
    // A continuation line, so a loose page still says what it belongs to.
    text(a4.side, y + 8, `${model.projectName} · ${model.title ?? model.typeLabel} · continued`, 'regular', 7.5, 'muted');
    y += 20;
  };
  const ensure = (height: number): void => {
    if (y + height > bottomLimit) {
      newPage();
    }
  };
  /** Wrapped lines from `top`; returns the height used. */
  const paragraph = (x: number, top: number, width: number, value: string, font: FontKey, size: number, colour: TextItem['colour'], leading = 1.32): number => {
    const k = key();
    const lines = wrapText(value, font, size, width, measure);
    lines.forEach((lineText, index) => {
      text(x, top + size + index * size * leading, lineText, font, size, colour, k);
    });
    return lines.length * size * leading;
  };

  // ---- the title band (first page only) ----
  const bandHeight = 92;
  items().push({ type: 'rect', x: 0, top: 0, width: a4.width, height: bandHeight, fill: 'navy' });
  text(a4.side, 32, `${model.typeLabel} · ${model.projectName}`.toUpperCase(), 'bold', 7.5, 'bandMuted');
  paragraph(a4.side, 40, contentWidth * 0.62, model.title ?? model.typeLabel, 'bold', 19, 'white', 1.15);
  const right = (top: number, value: string, font: FontKey, size: number, colour: Colour): void => {
    text(a4.width - a4.side - measure(value, font, size), top, value, font, size, colour);
  };
  right(36, model.periodLabel, 'bold', 10.5, 'white');
  right(52, `Prepared by ${model.author}`, 'regular', 8, 'bandMuted');
  right(65, `Generated ${model.generatedLabel}`, 'regular', 8, 'bandMuted');
  y = bandHeight + 18;

  if (model.note !== null) {
    const lines = model.note.split(/\r?\n/);
    const height = lines.reduce((sum, noteLine) => sum + wrapText(noteLine, 'italic', 9, contentWidth - 20, measure).length * 9 * 1.32, 0) + 14;
    items().push({ type: 'rect', x: a4.side, top: y, width: contentWidth, height, fill: 'note' });
    let top = y + 7;
    for (const noteLine of lines) {
      top += paragraph(a4.side + 10, top, contentWidth - 20, noteLine, 'italic', 9, 'ink2');
    }
    y += height + 14;
  }

  if (model.sections.length === 0) {
    y += paragraph(a4.side, y, contentWidth, model.emptyMessage ?? emptyReportMessage, 'regular', 10.5, 'ink') + 8;
  }

  // ---- key numbers as tiles ----
  const tiles = (summary: ReportSection['summary'], height: number, valueSize: number): void => {
    const perRow = Math.min(6, summary.length);
    const width = contentWidth / perRow;
    for (let start = 0; start < summary.length; start += perRow) {
      ensure(height);
      items().push({ type: 'rect', x: a4.side, top: y, width: contentWidth, height, fill: null, stroke: 'rule' });
      summary.slice(start, start + perRow).forEach((tile, index) => {
        const x = a4.side + index * width;
        if (index > 0) {
          items().push({ type: 'line', x1: x, x2: x, top: y, colour: 'rule', width: height });
        }
        text(x + 9, y + 8 + valueSize, String(tile.value), 'bold', valueSize, 'navy');
        const label = wrapText(tile.label.toUpperCase(), 'regular', 6.5, width - 14, measure)[0] ?? '';
        text(x + 9, y + height - 8, label, 'regular', 6.5, 'muted');
      });
      y += height + 8;
    }
  };

  const [first, ...others] = model.sections;
  const lead = first?.title === 'Summary' ? first : undefined;
  if (lead !== undefined) {
    tiles(lead.summary, 44, 16);
    y += 4;
  }

  // ---- the boxes ----
  const panels = (model.panels ?? []).slice(0, 2);
  if (panels.length > 0) {
    const gap = 10;
    const width = (contentWidth - gap * (panels.length - 1)) / panels.length;
    const heights = panels.map((panel) => panelHeight(panel, width, measure));
    const height = Math.max(...heights);
    ensure(height);
    panels.forEach((panel, index) => {
      const x = a4.side + index * (width + gap);
      items().push({ type: 'rect', x, top: y, width, height, fill: null, stroke: 'rule' });
      text(x + 10, y + 15, panel.title.toUpperCase(), 'bold', 7, 'muted');
      let top = y + 22;
      for (const entry of panel.items) {
        text(x + 10, top + 8.5, '•', 'regular', 8.5, 'muted');
        top += paragraph(x + 19, top, width - 29, entry, 'regular', 8.5, 'ink2') + 2;
      }
    });
    y += height + 14;
  }

  // ---- sections and their tables ----
  for (const section of lead === undefined ? model.sections : others) {
    // A heading never ends a page: it moves with its group title, column headings and first row.
    ensure(120);
    y += 10;
    text(a4.side, y + 12, section.title, 'bold', 12, 'navy');
    y += 18;
    items().push({ type: 'line', x1: a4.side, x2: a4.side + contentWidth, top: y, colour: 'rule', width: 0.8 });
    y += 8;
    if (section.summary.length > 0) {
      tiles(section.summary, 36, 13);
    }
    for (const group of section.groups) {
      drawTable(group, itemLabelFor(section.title, group.title));
    }
  }

  function drawTable(group: ReportGroup, itemLabel: string): void {
    const table = tableOf(group, itemLabel);
    const widths = columnWidths(table, measure);
    const header = (): void => {
      let x = a4.side;
      table.columns.forEach((column, index) => {
        text(x + cellPadX, y + 9, column.label.toUpperCase(), 'bold', 6.6, 'muted');
        x += widths[index] ?? 0;
      });
      y += 14;
      items().push({ type: 'line', x1: a4.side, x2: a4.side + contentWidth, top: y, colour: 'ink', width: 1.1 });
    };
    ensure(40);
    if (group.title !== null) {
      y += 4;
      text(a4.side, y + 10, group.title, 'bold', 9.5, 'ink');
      y += 16;
    }
    header();
    for (const row of table.rows) {
      const cells = row.cells.map((cell, index) => cellLines(cell, (widths[index] ?? 0) - 2 * cellPadX - (cell.kind === 'text' ? row.depth * 10 : 0), row.depth, measure));
      const height = Math.max(...cells.map((cell) => cell.height)) + 2 * cellPadY;
      if (y + height > bottomLimit) {
        newPage();
        header();
      }
      let x = a4.side;
      cells.forEach((cell, index) => {
        const indent = row.cells[index]?.kind === 'text' ? row.depth * 10 : 0;
        for (const piece of cell.pieces) {
          if (piece.kind === 'tag') {
            items().push({ type: 'rect', x: x + cellPadX + piece.dx, top: y + cellPadY + piece.dy, width: piece.width, height: tagHeight, fill: { tone: piece.tone } });
            text(x + cellPadX + piece.dx + tagPad, y + cellPadY + piece.dy + 8, piece.text, 'bold', tagSize, { tone: piece.tone }, piece.key);
          } else {
            text(x + cellPadX + indent + piece.dx, y + cellPadY + piece.dy, piece.text, piece.font, piece.size, piece.colour, piece.key);
          }
        }
        x += widths[index] ?? 0;
      });
      y += height;
      items().push({ type: 'line', x1: a4.side, x2: a4.side + contentWidth, top: y, colour: 'rule', width: 0.5 });
    }
    y += 12;
  }

  // ---- footers ----
  const footer = `${model.projectName} · ${model.typeLabel} · ${model.periodLabel}`;
  pages.forEach((page, index) => {
    const label = `Page ${String(index + 1)} of ${String(pages.length)}`;
    page.push({ type: 'line', x1: a4.side, x2: a4.side + contentWidth, top: a4.height - 34, colour: 'rule', width: 0.6 });
    page.push({ type: 'text', x: a4.side, top: a4.height - 22, text: footer, font: 'regular', size: 7.5, colour: 'muted', key: `f${String(index)}` });
    page.push({ type: 'text', x: a4.width - a4.side - measure(label, 'regular', 7.5), top: a4.height - 22, text: label, font: 'regular', size: 7.5, colour: 'muted', key: `p${String(index)}` });
  });
  return pages.map((page) => ({ items: page }));
}

function panelHeight(panel: ReportPanel, width: number, measure: Measure): number {
  return panel.items.reduce((sum, entry) => sum + wrapText(entry, 'regular', 8.5, width - 29, measure).length * 8.5 * 1.32 + 2, 30);
}

type Piece =
  | { readonly kind: 'text'; readonly dx: number; readonly dy: number; readonly text: string; readonly font: FontKey; readonly size: number; readonly colour: Colour; readonly key: string }
  | { readonly kind: 'tag'; readonly dx: number; readonly dy: number; readonly width: number; readonly text: string; readonly tone: Tone; readonly key: string };

let pieceKey = 0;
const nextPieceKey = (): string => {
  pieceKey += 1;
  return `c${String(pieceKey)}`;
};

/** One cell's pieces, positioned within the cell (dy is a baseline for text, a top for tags). */
function cellLines(cell: TableCell, width: number, depth: number, measure: Measure): { readonly pieces: readonly Piece[]; readonly height: number } {
  const pieces: Piece[] = [];
  let dy = 0;
  const add = (value: string, font: FontKey, size: number, colour: Colour): void => {
    const k = nextPieceKey();
    for (const lineText of wrapText(value, font, size, Math.max(width, 20), measure)) {
      pieces.push({ kind: 'text', dx: 0, dy: dy + size, text: lineText, font, size, colour, key: k });
      dy += size * 1.3;
    }
  };
  switch (cell.kind) {
    case 'text':
      add(cell.text, depth === 0 ? 'bold' : 'regular', depth === 0 ? 8.6 : 8.2, depth === 0 ? 'ink' : 'ink2');
      if (cell.sub !== null) {
        add(cell.sub, 'italic', 7.6, 'muted');
      }
      break;
    case 'plain':
      if (cell.text !== '') {
        add(cell.text, 'regular', 8.2, 'ink2');
      }
      break;
    case 'tags': {
      let dx = 0;
      for (const tag of cell.tags) {
        const tagW = tagWidth(tag.label, measure);
        if (dx > 0 && dx + tagW > width) {
          dx = 0;
          dy += tagHeight + 3;
        }
        pieces.push({ kind: 'tag', dx, dy, width: tagW, text: tag.label, tone: tag.tone, key: nextPieceKey() });
        dx += tagW + 4;
      }
      dy += cell.tags.length === 0 ? 0 : tagHeight;
      break;
    }
    default:
      return cell satisfies never;
  }
  return { pieces, height: dy };
}

/** Narrow columns take what their content needs (capped); the text column takes the rest. */
function columnWidths(table: ReturnType<typeof tableOf>, measure: Measure): readonly number[] {
  const textIndex = Math.max(0, table.columns.findIndex((column) => column.from === 'text'));
  const natural = table.columns.map((column, index) => {
    const header = measure(column.label.toUpperCase(), 'bold', 6.6);
    const content = Math.max(
      0,
      ...table.rows.map((row) => {
        const cell = row.cells[index];
        if (cell === undefined) {
          return 0;
        }
        if (cell.kind === 'tags') {
          return cell.tags.reduce((sum, tag, i) => sum + tagWidth(tag.label, measure) + (i > 0 ? 4 : 0), 0);
        }
        return measure(cell.text, 'regular', 8.2);
      }),
    );
    return Math.min(Math.max(header, content) + 2 * cellPadX + 2, contentWidth * 0.22);
  });
  const others = natural.reduce((sum, width, index) => sum + (index === textIndex ? 0 : width), 0);
  const minText = contentWidth * 0.34;
  const scale = contentWidth - others < minText ? (contentWidth - minText) / others : 1;
  const widths = natural.map((width, index) => (index === textIndex ? 0 : width * scale));
  widths[textIndex] = contentWidth - widths.reduce((sum, width) => sum + width, 0);
  return widths;
}

/** Every string through the PDF sanitiser, so measuring and drawing agree. */
function clean(model: ReportModel): ReportModel {
  const s = sanitizeForPdf;
  const line = (item: ReportModel['sections'][number]['groups'][number]['lines'][number]): typeof item => ({
    ...item,
    text: s(item.text),
    detail: item.detail === null ? null : s(item.detail),
    people: item.people.map(s),
    tags: item.tags.map((tag) => ({ ...tag, label: s(tag.label) })),
    ...(item.cells === undefined ? {} : { cells: item.cells.map((cell) => ({ label: cell.label, text: s(cell.text) })) }),
    children: item.children.map(line),
  });
  return {
    ...model,
    projectName: s(model.projectName),
    ...(model.title === undefined ? {} : { title: s(model.title) }),
    periodLabel: s(model.periodLabel),
    author: s(model.author),
    note: model.note === null ? null : s(model.note),
    ...(model.panels === undefined ? {} : { panels: model.panels.map((panel) => ({ title: s(panel.title), items: panel.items.map(s) })) }),
    sections: model.sections.map((section) => ({
      ...section,
      title: s(section.title),
      groups: section.groups.map((group) => ({ ...group, title: group.title === null ? null : s(group.title), lines: group.lines.map(line) })),
    })),
  };
}

/** The document's text as a reader meets it, wrapped pieces joined again (for tests). */
export function layoutText(pages: readonly PageLayout[]): readonly string[] {
  const out: { key: string; text: string }[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      if (item.type !== 'text') {
        continue;
      }
      const last = out[out.length - 1];
      if (last?.key === item.key) {
        last.text = `${last.text} ${item.text}`;
      } else {
        out.push({ key: item.key, text: item.text });
      }
    }
  }
  return out.map((entry) => entry.text);
}
