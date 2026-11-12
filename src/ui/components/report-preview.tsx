import type { ReportLineVM, ReportModelVM, ReportSectionVM } from '#src/ui/view-models/reports.ts';
import { StatusTag } from './status-tag.tsx';

export const emptyReportMessage = 'No work recorded for this period.';

const smallLabel = 'font-mono text-xs font-medium tracking-wide text-muted uppercase';

function Line({ line, nested = false }: { readonly line: ReportLineVM; readonly nested?: boolean }): React.JSX.Element {
  return (
    <li className={nested ? 'py-1' : 'border-b border-line py-2.5 last:border-b-0'}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`wrap-anywhere ${nested || line.children.length === 0 ? '' : 'font-semibold'}`}>{line.text}</span>
        {line.tags.map((tag) => (
          <StatusTag key={tag.label} status={tag} />
        ))}
        {line.people.length === 0 ? null : <span className="text-sm text-muted">— {line.people.join(', ')}</span>}
      </div>
      {line.detail === null ? null : <p className="mt-0.5 text-sm text-muted">{line.detail}</p>}
      {line.children.length === 0 ? null : (
        <ul className="mt-1.5 ml-1 border-l-2 border-line pl-4">
          {line.children.map((child, index) => (
            <Line key={`${child.text}-${String(index)}`} line={child} nested />
          ))}
        </ul>
      )}
    </li>
  );
}

/** A section's counts as tiles: the number first, what it counts underneath. */
function Summary({ summary }: { readonly summary: ReportSectionVM['summary'] }): React.JSX.Element {
  return (
    <dl className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
      {summary.map((item) => (
        <div key={item.label} className="flex flex-col-reverse justify-end gap-0.5 rounded-md border border-line bg-page px-4 py-3">
          <dt className="text-sm text-muted">{item.label}</dt>
          <dd className="text-xl font-bold tracking-tight tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** R-02: the preview renders the same report model as the PDF and Markdown exports. */
export function ReportPreview({ model }: { readonly model: ReportModelVM }): React.JSX.Element {
  return (
    <article className="rounded-lg border border-line bg-surface shadow-sm" aria-label="Report preview">
      <header className="grid gap-2 border-b border-line p-6 sm:px-10 sm:py-8">
        <h2 className="text-2xl tracking-tight">
          {model.projectName} — {model.typeLabel}
        </h2>
        <p className="text-muted">
          <strong className="text-fg">{model.periodLabel}</strong> · Prepared by {model.author} · Generated {model.generatedLabel}
        </p>
        {model.note === null ? null : <blockquote className="mt-3 rounded-md bg-sunken px-4 py-3 whitespace-pre-line">{model.note}</blockquote>}
      </header>
      <div className="grid gap-10 p-6 sm:px-10 sm:py-8">
        {model.sections.length === 0 ? <p>{emptyReportMessage}</p> : null}
        {model.sections.map((section) => (
          <section key={section.title} className="grid gap-4">
            <h3 className="flex items-center gap-3 text-lg after:h-px after:flex-1 after:bg-line">{section.title}</h3>
            {section.summary.length === 0 ? null : <Summary summary={section.summary} />}
            {section.groups.map((group, index) => (
              <div key={group.title ?? String(index)}>
                {group.title === null ? null : <h4 className={`mb-1 ${smallLabel}`}>{group.title}</h4>}
                <ul>
                  {group.lines.map((line, lineIndex) => (
                    <Line key={`${line.text}-${String(lineIndex)}`} line={line} />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
