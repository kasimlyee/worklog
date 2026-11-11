import type { ReportLineVM, ReportModelVM } from '#src/ui/view-models/reports.ts';
import { StatusTag } from './status-tag.tsx';
import styles from './report-preview.module.css';

export const emptyReportMessage = 'No work recorded for this period.';

function Line({ line }: { readonly line: ReportLineVM }): React.JSX.Element {
  return (
    <li>
      <span className={styles.text}>{line.text}</span>
      {line.tags.map((tag) => (
        <StatusTag key={tag.label} status={tag} />
      ))}
      {line.detail === null ? null : <span className={styles.detail}>{line.detail}</span>}
      {line.people.length === 0 ? null : <span className={styles.people}>— {line.people.join(', ')}</span>}
      {line.children.length === 0 ? null : (
        <ul>
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
    <article className={styles.report} aria-label="Report preview">
      <header className={styles.header}>
        <h2>
          {model.projectName} — {model.typeLabel}
        </h2>
        <p>
          <strong>{model.periodLabel}</strong> · Prepared by {model.author} · Generated {model.generatedLabel}
        </p>
        {model.note === null ? null : <blockquote className={styles.note}>{model.note}</blockquote>}
      </header>
      {model.sections.length === 0 ? <p>{emptyReportMessage}</p> : null}
      {model.sections.map((section) => (
        <section key={section.title} className={styles.section}>
          <h3>{section.title}</h3>
          {section.summary.length === 0 ? null : (
            <dl className={styles.summary}>
              {section.summary.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {section.groups.map((group, index) => (
            <div key={group.title ?? String(index)}>
              {group.title === null ? null : <h4>{group.title}</h4>}
              <ul>
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
