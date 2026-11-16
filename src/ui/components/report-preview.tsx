import { itemLabelFor, tableOf, type TableCell } from '#src/lib/report-table.ts';
import type { ReportModelVM, ReportSectionVM } from '#src/ui/view-models/reports.ts';
import { StatusTag } from './status-tag.tsx';

export const emptyReportMessage = 'No work recorded for this period.';

const smallLabel = 'font-mono text-xs font-medium tracking-wide text-muted uppercase';

/** The key numbers as tiles in one bordered strip. */
function Tiles({ summary }: { readonly summary: ReportSectionVM['summary'] }): React.JSX.Element {
  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] overflow-hidden rounded-md border border-line">
      {summary.map((item) => (
        <div key={item.label} className="flex flex-col-reverse justify-end gap-0.5 border-line px-4 py-3 not-first:border-l">
          <dt className="text-xs tracking-wide text-muted uppercase">{item.label}</dt>
          <dd className="text-xl font-bold tracking-tight tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Cell({ cell, depth }: { readonly cell: TableCell; readonly depth: number }): React.JSX.Element {
  switch (cell.kind) {
    case 'text':
      return (
        <div className={depth > 0 ? 'pl-4 text-sm text-muted' : 'font-semibold'}>
          <span className="wrap-anywhere">{cell.text}</span>
          {cell.sub === null ? null : <p className="mt-0.5 text-xs font-normal text-muted">{cell.sub}</p>}
        </div>
      );
    case 'tags':
      return (
        <div className="flex flex-wrap gap-1">
          {cell.tags.map((tag) => (
            <StatusTag key={tag.label} status={tag} />
          ))}
        </div>
      );
    case 'plain':
      return <span className="text-sm">{cell.text}</span>;
    default:
      return cell satisfies never;
  }
}

function Group({ group, itemLabel }: { readonly group: ReportSectionVM['groups'][number]; readonly itemLabel: string }): React.JSX.Element {
  const table = tableOf(group, itemLabel);
  return (
    <div className="grid gap-2">
      {group.title === null ? null : <h4 className="text-sm font-bold">{group.title}</h4>}
      <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label={`${group.title ?? itemLabel}, scrollable`}>
        <table>
          <thead>
            <tr>
              {table.columns.map((column) => (
                <th key={column.label} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={String(index)}>
                {row.cells.map((cell, cellIndex) => (
                  <td key={String(cellIndex)}>
                    <Cell cell={cell} depth={row.depth} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** R-02, D-19: the preview draws the same document as the PDF and Markdown exports. */
export function ReportPreview({ model }: { readonly model: ReportModelVM }): React.JSX.Element {
  const [first, ...rest] = model.sections;
  const lead = first?.title === 'Summary' ? first : undefined;
  const sections = lead === undefined ? model.sections : rest;
  return (
    <article className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm" aria-label="Report preview">
      <header className="flex flex-wrap items-end justify-between gap-4 bg-[#1d2b4f] px-6 py-6 text-[#ffffff] sm:px-10">
        <div className="grid gap-1">
          <p className="text-xs font-semibold tracking-widest text-[#c7cee6] uppercase">
            {model.typeLabel} · {model.projectName}
          </p>
          <h2 className="text-2xl tracking-tight text-[#ffffff]">{model.title ?? model.typeLabel}</h2>
        </div>
        <p className="grid text-right text-sm text-[#c7cee6]">
          <strong className="text-base text-[#ffffff]">{model.periodLabel}</strong>
          <span>Prepared by {model.author}</span>
          <span>Generated {model.generatedLabel}</span>
        </p>
      </header>
      <div className="grid gap-8 p-6 sm:px-10 sm:py-8">
        {model.note === null ? null : <blockquote className="rounded-md bg-sunken px-4 py-3 whitespace-pre-line">{model.note}</blockquote>}
        {model.sections.length === 0 ? <p>{model.emptyMessage ?? emptyReportMessage}</p> : null}
        {lead === undefined ? null : <Tiles summary={lead.summary} />}
        {(model.panels ?? []).length === 0 ? null : (
          <div className="grid gap-3 md:grid-cols-2">
            {(model.panels ?? []).map((panel) => (
              <section key={panel.title} className="rounded-md border border-line p-4" aria-label={panel.title}>
                <h3 className={smallLabel}>{panel.title}</h3>
                <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm">
                  {panel.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        {sections.map((section) => (
          <section key={section.title} className="grid gap-4">
            <h3 className="flex items-center gap-3 text-lg after:h-px after:flex-1 after:bg-line">{section.title}</h3>
            {section.summary.length === 0 ? null : <Tiles summary={section.summary} />}
            {section.groups.map((group, index) => (
              <Group key={group.title ?? String(index)} group={group} itemLabel={itemLabelFor(section.title, group.title)} />
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
