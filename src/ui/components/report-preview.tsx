import type { ReportLineVM, ReportModelVM } from '#src/ui/view-models/reports.ts';
import { StatusTag } from './status-tag.tsx';

const bullets = 'my-1 list-disc pl-6';

export const emptyReportMessage = 'No work recorded for this period.';

function Line({ line }: { readonly line: ReportLineVM }): React.JSX.Element {
  return (
    <li className="my-1 [&>*+*]:ml-2">
      <span className="wrap-anywhere">{line.text}</span>
      {line.tags.map((tag) => (
        <StatusTag key={tag.label} status={tag} />
      ))}
      {line.detail === null ? null : <span className="text-sm text-muted italic">{line.detail}</span>}
      {line.people.length === 0 ? null : <span className="text-sm text-muted">— {line.people.join(', ')}</span>}
      {line.children.length === 0 ? null : (
        <ul className={bullets}>
          {line.children.map((child, index) => (
            <Line key={`${child.text}-${String(index)}`} line={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** R-02: the preview renders the same report model as the PDF and Markdown exports. */
export function ReportPreview({ model }: { readonly model: ReportModelVM }): React.JSX.Element {
  return (
    <article className="grid gap-6 rounded-lg border border-line bg-surface p-6 shadow-sm sm:p-10" aria-label="Report preview">
      <header className="grid gap-2 border-b border-line pb-6">
        <h2 className="text-2xl tracking-tight">
          {model.projectName} — {model.typeLabel}
        </h2>
        <p className="text-muted">
          <strong>{model.periodLabel}</strong> · Prepared by {model.author} · Generated {model.generatedLabel}
        </p>
        {model.note === null ? null : <blockquote className="mt-2 border-l-[3px] border-line-strong pl-3 whitespace-pre-line italic">{model.note}</blockquote>}
      </header>
      {model.sections.length === 0 ? <p>{emptyReportMessage}</p> : null}
      {model.sections.map((section) => (
        <section key={section.title} className="grid gap-2">
          <h3 className="text-lg">{section.title}</h3>
          {section.summary.length === 0 ? null : (
            <dl className="flex flex-wrap gap-x-6 gap-y-2">
              {section.summary.map((item) => (
                <div key={item.label} className="flex gap-1">
                  <dt className="text-muted after:content-[':']">{item.label}</dt>
                  <dd className="font-bold">{item.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {section.groups.map((group, index) => (
            <div key={group.title ?? String(index)}>
              {group.title === null ? null : <h4 className="mt-2 text-base">{group.title}</h4>}
              <ul className={bullets}>
                {group.lines.map((line, lineIndex) => (
                  <Line key={`${line.text}-${String(lineIndex)}`} line={line} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}
