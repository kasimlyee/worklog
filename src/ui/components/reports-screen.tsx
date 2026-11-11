import Link from 'next/link';
import type { FormAction } from '#src/ui/view-models/forms.ts';
import type { ReportKind, ReportsVM } from '#src/ui/view-models/reports.ts';
import { projectHref } from '#src/ui/routes.ts';
import { ActionForm, HiddenField, TextAreaField } from './form.tsx';
import { PageHeader, Section } from './page-header.tsx';
import { ReportPreview } from './report-preview.tsx';
import styles from './lists.module.css';

const kinds: readonly { readonly value: ReportKind; readonly label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

/** Product spec §6: choose type and period → preview → export. Report note editable here. */
export function ReportsScreen({ projectId, vm, saveNote }: { readonly projectId: string; readonly vm: ReportsVM; readonly saveNote: FormAction }): React.JSX.Element {
  return (
    <div className={styles.stack}>
      <PageHeader
        title="Reports"
        actions={
          <>
            {/* Plain links: downloads are GET route handlers (docs/02 §9). */}
            <a className="button" data-variant="primary" href={vm.pdfHref} download>
              Export PDF
            </a>
            <a className="button" href={vm.markdownHref} download>
              Export Markdown
            </a>
          </>
        }
      />
      <div className={styles.toolbar}>
        <nav aria-label="Report type" className={styles.tabs}>
          {kinds.map((kind) => (
            <Link key={kind.value} href={projectHref(projectId, 'reports', `kind=${kind.value}&date=${vm.start}`)} aria-current={vm.kind === kind.value ? 'page' : undefined}>
              {kind.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Report period" className={styles.row}>
          <Link className="button" data-size="small" href={projectHref(projectId, 'reports', vm.previousQuery)}>
            ← Previous
          </Link>
          <span className={styles.periodLabel}>{vm.model.periodLabel}</span>
          <Link className="button" data-size="small" href={projectHref(projectId, 'reports', vm.nextQuery)}>
            Next →
          </Link>
        </nav>
      </div>
      <Section title="Report note">
        <ActionForm action={saveNote} submitLabel="Save note" label="Report note">
          <HiddenField name="kind" value={vm.kind} />
          <HiddenField name="periodStart" value={vm.start} />
          <TextAreaField name="body" label="Note shown under the header" defaultValue={vm.note} maxLength={5000} rows={3} hint="Leave empty for no note." />
        </ActionForm>
      </Section>
      <ReportPreview model={vm.model} />
    </div>
  );
}
