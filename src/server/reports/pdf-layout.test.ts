import { describe, expect, it } from 'vitest';
import { layoutBlocks, type Block, type LayoutOptions, type Measure } from './pdf-layout.ts';

// Every character is half the font size wide: easy arithmetic.
const measure: Measure = (text, _font, size) => text.length * size * 0.5;

// 100pt of content width, 100pt of content height, 10pt text → 14pt lines → 7 lines per page.
const small: LayoutOptions = {
  pageWidth: 120,
  pageHeight: 120,
  margin: { top: 10, right: 10, bottom: 10, left: 10 },
  lineSpacing: 1.4,
  tagPadding: 2,
};

const text = (value: string, extra: Partial<Block> = {}): Block => ({
  runs: [{ text: value, font: 'regular', size: 10, ink: 'text' }],
  indent: 0,
  spaceBefore: 0,
  ...extra,
});

const lineTexts = (pages: ReturnType<typeof layoutBlocks>) =>
  pages.map((page) => {
    const byLine = new Map<number, string[]>();
    for (const item of page.items) {
      byLine.set(item.y, [...(byLine.get(item.y) ?? []), item.text]);
    }
    return [...byLine.values()].map((parts) => parts.join(''));
  });

describe('PDF layout', () => {
  it('wraps words to the content width (20 characters of 5pt)', () => {
    const pages = layoutBlocks([text('aaaa bbbb cccc dddd eeee ffff')], measure, small);

    expect(lineTexts(pages)).toEqual([['aaaa bbbb cccc dddd', 'eeee ffff']]);
  });

  it('starts every line at the left margin plus the block indent', () => {
    const [page] = layoutBlocks([text('x', { indent: 15 })], measure, small);

    expect(page?.items[0]?.x).toBe(25);
  });

  it('splits a word longer than a whole line', () => {
    const pages = layoutBlocks([text('a'.repeat(45))], measure, small);

    expect(lineTexts(pages)).toEqual([['a'.repeat(20), 'a'.repeat(20), 'a'.repeat(5)]]);
  });

  it('breaks onto a new page when the page is full', () => {
    const blocks = Array.from({ length: 9 }, (_, i) => text(`line ${String(i)}`));

    const pages = layoutBlocks(blocks, measure, small);

    expect(lineTexts(pages).map((lines) => lines.length)).toEqual([7, 2]);
  });

  it('moves a heading to the next page rather than leaving it alone at the bottom', () => {
    const blocks = [...Array.from({ length: 6 }, (_, i) => text(`line ${String(i)}`)), text('Heading', { keepWithNext: true }), text('body')];

    const pages = lineTexts(layoutBlocks(blocks, measure, small));

    expect(pages[1]).toEqual(['Heading', 'body']);
  });

  it('drops the space before a block at the top of a page', () => {
    const [page] = layoutBlocks([text('first', { spaceBefore: 30 })], measure, small);

    expect(page?.items[0]?.y).toBeCloseTo(110 - 14 + 14 * 0.3);
  });

  it('adds the space before a block elsewhere', () => {
    const [page] = layoutBlocks([text('a'), text('b', { spaceBefore: 6 })], measure, small);

    const [a, b] = page?.items ?? [];
    expect((a?.y ?? 0) - (b?.y ?? 0)).toBeCloseTo(20);
  });

  it('keeps tags whole and pads them', () => {
    const block: Block = {
      runs: [
        { text: 'PR title', font: 'regular', size: 10, ink: 'text' },
        { text: ' ', font: 'regular', size: 10, ink: 'text' },
        { text: 'Merged soon', font: 'bold', size: 10, ink: 'text', tag: 'success' },
      ],
      indent: 0,
      spaceBefore: 0,
    };

    const [page] = layoutBlocks([block], measure, small);

    expect(page?.items.find((item) => item.tag === 'success')).toMatchObject({ text: 'Merged soon', width: 59 });
  });

  it('returns one empty page for no blocks, and a line for an empty block', () => {
    expect(layoutBlocks([], measure, small)).toEqual([{ items: [], rules: [] }]);
    expect(layoutBlocks([text('')], measure, small)).toEqual([{ items: [], rules: [] }]);
  });

  it('draws a rule under a heading across the content width, with the next block clear of it', () => {
    const [page] = layoutBlocks([text('Heading', { ruleBelow: true }), text('Body')], measure, small);

    // The heading's 14pt line ends at y = 96; the rule sits 4pt below it.
    expect(page?.rules).toEqual([{ x: 10, y: 92, width: 100 }]);
    expect(page?.items.find((item) => item.text === 'Body')?.y).toBeLessThan(92);
  });

  it('places a tall line on an empty page even if it does not fit', () => {
    const huge: Block = { runs: [{ text: 'X', font: 'bold', size: 200, ink: 'text' }], indent: 0, spaceBefore: 0 };

    expect(layoutBlocks([huge], measure, small)).toHaveLength(1);
  });
});
