import { PDFDocument, StandardFonts, rgb, type PDFFont, type RGB } from 'pdf-lib';
import type { ReportModel, Tone } from './model.ts';
import { a4, layoutReport, type Colour, type FontKey, type PageLayout } from './pdf-layout.ts';
import { sanitizeForPdf } from './pdf-sanitize.ts';

/* §7.5, D-19: A4 portrait, a status-report layout, status labels as coloured pills, page numbers. */

const colours: Readonly<Record<Colour, RGB>> = {
  ink: rgb(0.106, 0.122, 0.153),
  ink2: rgb(0.29, 0.318, 0.376),
  muted: rgb(0.54, 0.57, 0.63),
  navy: rgb(0.114, 0.169, 0.31),
  white: rgb(1, 1, 1),
  bandMuted: rgb(0.78, 0.81, 0.9),
  rule: rgb(0.89, 0.9, 0.925),
  tile: rgb(0.957, 0.961, 0.973),
  note: rgb(0.957, 0.961, 0.973),
};

// The same semantic colours as the UI tokens (product spec §5).
const toneColours: Readonly<Record<Tone, { readonly fill: RGB; readonly text: RGB }>> = {
  success: { fill: rgb(0.906, 0.961, 0.929), text: rgb(0.13, 0.48, 0.28) },
  warning: { fill: rgb(1, 0.953, 0.839), text: rgb(0.54, 0.35, 0) },
  danger: { fill: rgb(0.992, 0.91, 0.914), text: rgb(0.7, 0.14, 0.16) },
  neutral: { fill: rgb(0.933, 0.941, 0.953), text: rgb(0.36, 0.38, 0.45) },
};

type Fonts = Readonly<Record<FontKey, PDFFont>>;

function colourOf(value: Colour | { readonly tone: Tone }, part: 'fill' | 'text'): RGB {
  return typeof value === 'string' ? colours[value] : toneColours[value.tone][part];
}

function drawPage(doc: PDFDocument, layout: PageLayout, fonts: Fonts): void {
  const page = doc.addPage([a4.width, a4.height]);
  const flip = (top: number): number => a4.height - top;
  for (const item of layout.items) {
    switch (item.type) {
      case 'rect':
        page.drawRectangle({
          x: item.x,
          y: flip(item.top + item.height),
          width: item.width,
          height: item.height,
          ...(item.fill === null ? {} : { color: colourOf(item.fill, 'fill') }),
          ...(item.stroke === undefined ? {} : { borderColor: colours[item.stroke], borderWidth: 0.7 }),
        });
        break;
      case 'line':
        // A vertical divider has x1 === x2 and uses `width` as its height.
        if (item.x1 === item.x2) {
          page.drawLine({ start: { x: item.x1, y: flip(item.top) }, end: { x: item.x1, y: flip(item.top + item.width) }, thickness: 0.6, color: colours[item.colour] });
        } else {
          page.drawLine({ start: { x: item.x1, y: flip(item.top) }, end: { x: item.x2, y: flip(item.top) }, thickness: item.width, color: colours[item.colour] });
        }
        break;
      case 'text':
        page.drawText(item.text, { x: item.x, y: flip(item.top), size: item.size, font: fonts[item.font], color: colourOf(item.colour, 'text') });
        break;
      default:
        item satisfies never;
    }
  }
}

/** The report or plan as a PDF file (R-02: content only from the model). */
export async function renderPdf(model: ReportModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const pages = layoutReport(model, (text, font, size) => fonts[font].widthOfTextAtSize(text, size));
  for (const layout of pages) {
    drawPage(doc, layout, fonts);
  }
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
