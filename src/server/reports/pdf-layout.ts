import type { Tone } from './model.ts';

/*
 * Pure page layout for the PDF (docs/02 §9): wraps text, breaks pages, keeps headings
 * with what follows. Text width comes from an injected `measure`, so this is tested
 * without pdf-lib. Coordinates are PDF points, origin bottom-left.
 */

export type FontKey = 'regular' | 'bold' | 'italic';
export type Ink = 'text' | 'muted';

export type Run = {
  readonly text: string;
  readonly font: FontKey;
  readonly size: number;
  readonly ink: Ink;
  /** Draw as a coloured status tag (a filled box behind the label). */
  readonly tag?: Tone;
};

export type Block = {
  readonly runs: readonly Run[];
  readonly indent: number;
  readonly spaceBefore: number;
  /** Never leave this block as the last thing on a page (headings). */
  readonly keepWithNext?: boolean;
};

export type Placed = {
  readonly x: number;
  /** Baseline. */
  readonly y: number;
  readonly width: number;
  readonly lineHeight: number;
} & Run;

export type PageLayout = { readonly items: readonly Placed[] };

export type Measure = (text: string, font: FontKey, size: number) => number;

export type LayoutOptions = {
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly margin: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  readonly lineSpacing: number;
  readonly tagPadding: number;
};

/** A4 portrait in points (§7.5). */
export const a4: LayoutOptions = {
  pageWidth: 595.28,
  pageHeight: 841.89,
  margin: { top: 56, right: 56, bottom: 64, left: 56 },
  lineSpacing: 1.4,
  tagPadding: 3,
};

type Piece = Run & { readonly width: number; readonly isSpace: boolean };
type Line = { readonly pieces: readonly Piece[]; readonly height: number };

function pieceWidth(run: Run, measure: Measure, padding: number): number {
  return measure(run.text, run.font, run.size) + (run.tag === undefined ? 0 : 2 * padding);
}

/** Splits runs into words and spaces; tags stay whole. */
function piecesOf(runs: readonly Run[], measure: Measure, padding: number): readonly Piece[] {
  return runs.flatMap((run) => {
    const parts = run.tag === undefined ? run.text.split(/(\s+)/).filter((part) => part !== '') : [run.text];
    return parts.map((text) => {
      const piece = { ...run, text };
      return { ...piece, width: pieceWidth(piece, measure, padding), isSpace: run.tag === undefined && /^\s+$/.test(text) };
    });
  });
}

/** Splits a word wider than a whole line into chunks that fit. */
function splitLongWord(piece: Piece, maxWidth: number, measure: Measure): readonly Piece[] {
  const chunks: Piece[] = [];
  let current = '';
  for (const char of piece.text) {
    const candidate = current + char;
    if (current !== '' && measure(candidate, piece.font, piece.size) > maxWidth) {
      chunks.push({ ...piece, text: current, width: measure(current, piece.font, piece.size) });
      current = char;
    } else {
      current = candidate;
    }
  }
  chunks.push({ ...piece, text: current, width: measure(current, piece.font, piece.size) });
  return chunks;
}

function wrap(block: Block, width: number, measure: Measure, options: LayoutOptions): readonly Line[] {
  const lines: Line[] = [];
  let pieces: Piece[] = [];
  let used = 0;
  const flush = (): void => {
    while (pieces.at(-1)?.isSpace === true) {
      pieces.pop();
    }
    const height = Math.max(0, ...pieces.map((piece) => piece.size)) * options.lineSpacing;
    lines.push({ pieces, height });
    pieces = [];
    used = 0;
  };
  const all = piecesOf(block.runs, measure, options.tagPadding).flatMap((piece) =>
    !piece.isSpace && piece.width > width ? splitLongWord(piece, width, measure) : [piece],
  );
  for (const piece of all) {
    if (piece.isSpace && pieces.length === 0) {
      continue;
    }
    if (!piece.isSpace && used + piece.width > width && pieces.length > 0) {
      flush();
    }
    pieces.push(piece);
    used += piece.width;
  }
  if (pieces.length > 0 || lines.length === 0) {
    flush();
  }
  return lines;
}

/** Lays out blocks top to bottom over as many pages as needed. Always returns at least one page. */
export function layoutBlocks(blocks: readonly Block[], measure: Measure, options: LayoutOptions = a4): readonly PageLayout[] {
  const { pageWidth, pageHeight, margin } = options;
  const contentWidth = pageWidth - margin.left - margin.right;
  const top = pageHeight - margin.top;
  const pages: Placed[][] = [[]];
  let y = top;
  const newPage = (): void => {
    pages.push([]);
    y = top;
  };
  const wrapped = blocks.map((block) => ({ block, lines: wrap(block, contentWidth - block.indent, measure, options) }));

  wrapped.forEach(({ block, lines }, index) => {
    const atTop = y === top;
    const gap = atTop ? 0 : block.spaceBefore;
    if (block.keepWithNext === true) {
      const next = wrapped[index + 1];
      const height = lines.reduce((sum, line) => sum + line.height, 0) + (next === undefined ? 0 : next.block.spaceBefore + (next.lines[0]?.height ?? 0));
      if (!atTop && y - gap - height < margin.bottom) {
        newPage();
      }
    }
    y -= y === top ? 0 : gap;
    for (const line of lines) {
      if (y - line.height < margin.bottom && y !== top) {
        newPage();
      }
      y -= line.height;
      // Baseline sits a little above the bottom of the line box.
      const baseline = y + line.height * 0.3;
      let x = margin.left + block.indent;
      for (const piece of line.pieces) {
        pages.at(-1)?.push({
          text: piece.text,
          font: piece.font,
          size: piece.size,
          ink: piece.ink,
          ...(piece.tag === undefined ? {} : { tag: piece.tag }),
          x,
          y: baseline,
          width: piece.width,
          lineHeight: line.height,
        });
        x += piece.width;
      }
    }
  });
  return pages.map((items) => ({ items }));
}
