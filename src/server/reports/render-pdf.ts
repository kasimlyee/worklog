import { PDFDocument, StandardFonts, rgb, type PDFFont, type RGB } from 'pdf-lib';
import { emptyReportMessage, type ReportLine, type ReportModel, type Tone } from './model.ts';
import { a4, layoutBlocks, type Block, type FontKey, type Ink, type PageLayout, type Run } from './pdf-layout.ts';
import { sanitizeForPdf } from './pdf-sanitize.ts';

/* §7.5: A4 portrait, plain typography, status labels as coloured tags, page numbers. */

const ink: Readonly<Record<Ink, RGB>> = { text: rgb(0.11, 0.12, 0.14), muted: rgb(0.38, 0.4, 0.44) };

// The same semantic colours as the UI tokens (product spec §5).
const tagColours: Readonly<Record<Tone, { readonly fill: RGB; readonly text: RGB }>> = {
  success: { fill: rgb(0.86, 0.95, 0.88), text: rgb(0.09, 0.4, 0.2) },
  warning: { fill: rgb(1, 0.95, 0.76), text: rgb(0.48, 0.33, 0) },
  danger: { fill: rgb(0.99, 0.89, 0.89), text: rgb(0.6, 0.11, 0.11) },
  neutral: { fill: rgb(0.92, 0.93, 0.94), text: rgb(0.3, 0.32, 0.36) },
};

const run = (text: string, font: FontKey, size: number, color: Ink = 'text', tag?: Tone): Run => ({
  text: sanitizeForPdf(text),
  font,
  size,
  ink: color,
  ...(tag === undefined ? {} : { tag }),
});

function lineBlocks(item: ReportLine, depth: number): readonly Block[] {
  const runs: Run[] = [run('•  ', 'regular', 10, 'muted'), run(item.text, 'regular', 10)];
  for (const tag of item.tags) {
    runs.push(run(' ', 'regular', 10), run(tag.label, 'bold', 8, 'text', tag.tone));
  }
  if (item.detail !== null) {
    runs.push(run(`  ${item.detail}`, 'italic', 9, 'muted'));
  }
  if (item.people.length > 0) {
    runs.push(run(`  — ${item.people.join(', ')}`, 'regular', 9, 'muted'));
  }
  return [{ runs, indent: depth * 14, spaceBefore: 3 }, ...item.children.flatMap((child) => lineBlocks(child, depth + 1))];
}

/** The report as layout blocks — the PDF's content, in order. */
export function reportBlocks(model: ReportModel): readonly Block[] {
  const blocks: Block[] = [
    { runs: [run(`${model.projectName} — ${model.typeLabel}`, 'bold', 18)], indent: 0, spaceBefore: 0 },
    {
      runs: [
        run(model.periodLabel, 'bold', 11),
        run(`  ·  Prepared by ${model.author}  ·  Generated ${model.generatedLabel}`, 'regular', 10, 'muted'),
      ],
      indent: 0,
      spaceBefore: 4,
    },
  ];
  if (model.note !== null) {
    blocks.push(
      ...model.note.split(/\r?\n/).map((noteLine, index) => ({ runs: [run(noteLine, 'italic', 10, 'muted')], indent: 10, spaceBefore: index === 0 ? 10 : 2 })),
    );
  }
  if (model.sections.length === 0) {
    blocks.push({ runs: [run(emptyReportMessage, 'regular', 11)], indent: 0, spaceBefore: 18 });
  }
  for (const section of model.sections) {
    blocks.push({ runs: [run(section.title, 'bold', 14)], indent: 0, spaceBefore: 18, keepWithNext: true });
    if (section.summary.length > 0) {
      blocks.push({
        runs: section.summary.flatMap((item, index) => [
          run(`${index === 0 ? '' : '   ·   '}${item.label}: `, 'regular', 10, 'muted'),
          run(String(item.value), 'bold', 10),
        ]),
        indent: 0,
        spaceBefore: 4,
      });
    }
    for (const group of section.groups) {
      if (group.title !== null) {
        blocks.push({ runs: [run(group.title, 'bold', 11)], indent: 0, spaceBefore: 10, keepWithNext: true });
      }
      blocks.push(...group.lines.flatMap((item) => lineBlocks(item, 0)));
    }
  }
  return blocks;
}

type Fonts = Readonly<Record<FontKey, PDFFont>>;

function drawPage(doc: PDFDocument, layout: PageLayout, fonts: Fonts, footer: string, pageLabel: string): void {
  const page = doc.addPage([a4.pageWidth, a4.pageHeight]);
  for (const item of layout.items) {
    const font = fonts[item.font];
    if (item.tag === undefined) {
      page.drawText(item.text, { x: item.x, y: item.y, size: item.size, font, color: ink[item.ink] });
      continue;
    }
    const colours = tagColours[item.tag];
    const height = item.size + 2 * a4.tagPadding;
    page.drawRectangle({ x: item.x, y: item.y - a4.tagPadding - 1, width: item.width, height, color: colours.fill });
    page.drawText(item.text, { x: item.x + a4.tagPadding, y: item.y, size: item.size, font, color: colours.text });
  }
  const footerY = a4.margin.bottom / 2;
  page.drawText(footer, { x: a4.margin.left, y: footerY, size: 8, font: fonts.regular, color: ink.muted });
  const labelWidth = fonts.regular.widthOfTextAtSize(pageLabel, 8);
  page.drawText(pageLabel, { x: a4.pageWidth - a4.margin.right - labelWidth, y: footerY, size: 8, font: fonts.regular, color: ink.muted });
}

/** The report as a PDF file (R-02: content only from the model). */
export async function renderPdf(model: ReportModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const pages = layoutBlocks(reportBlocks(model), (text, font, size) => fonts[font].widthOfTextAtSize(text, size));
  const footer = sanitizeForPdf(`${model.projectName} · ${model.typeLabel} · ${model.periodLabel}`);
  pages.forEach((layout, index) => {
    drawPage(doc, layout, fonts, footer, `Page ${String(index + 1)} of ${String(pages.length)}`);
  });
  doc.setTitle(sanitizeForPdf(`${model.projectName} — ${model.typeLabel} — ${model.periodLabel}`));
  doc.setAuthor(sanitizeForPdf(model.author));
  doc.setProducer('Worklog');
  doc.setCreator('Worklog');
  return await doc.save();
}

/** §7.5: `{project-slug}_{type}_{period-start}.{ext}` */
export function reportFileName(model: ReportModel, extension: 'pdf' | 'md'): string {
  return `${model.projectSlug}_${model.kind}_${model.periodStart}.${extension}`;
}
