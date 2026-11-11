import Link from 'next/link';
import type { Pickers } from '#src/ui/view-models/common.ts';
import type { FormAction, PlainAction } from '#src/ui/view-models/forms.ts';
import type { ReleaseDetailVM, ReleaseFormValues, ReleaseVM } from '#src/ui/view-models/releases.ts';
import { newItemHref, projectHref, projectItemHref } from '#src/ui/routes.ts';
import { ConfirmDialog } from './confirm-dialog.tsx';
import { EmptyState } from './empty-state.tsx';
import { ExternalLink } from './external-link.tsx';
import { ActionForm, CheckboxGroupField, SelectField, TextAreaField, TextField } from './form.tsx';
import { MarkdownView } from './markdown-view.tsx';
import { PageHeader, Section } from './page-header.tsx';
import { StatusTag } from './status-tag.tsx';
import styles from './lists.module.css';

function dates(release: ReleaseVM): string {
  return [release.releasedLabel === null ? null : `Released ${release.releasedLabel}`, release.targetLabel === null ? null : `Target ${release.targetLabel}`]
    .filter((part) => part !== null)
    .join(' · ');
}

export function ReleasesScreen({ projectId, releases }: { readonly projectId: string; readonly releases: readonly ReleaseVM[] }): React.JSX.Element {
  return (
    <div>
      <PageHeader
        title="Releases"
        actions={
          <Link className="button" data-variant="primary" href={newItemHref(projectId, 'releases')}>
            New release
          </Link>
        }
      />
      <Section title="All releases">
        {releases.length === 0 ? (
          <EmptyState>No releases yet.</EmptyState>
        ) : (
          <ul className={styles.list}>
            {releases.map((release) => (
              <li key={release.id} className={styles.item}>
                <div className={styles.row}>
                  <Link className={styles.title} href={projectItemHref(projectId, 'releases', release.id)}>
                    {release.version}
                  </Link>
                  <StatusTag status={release.status} />
                </div>
                <div className={styles.meta}>
                  <span>{dates(release)}</span>
                  <span>{release.pullRequests.length} pull requests</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function ReleaseFields({ pickers, values }: { readonly pickers: Pickers; readonly values: ReleaseFormValues }): React.JSX.Element {
  return (
    <>
      <TextField name="version" label="Version" defaultValue={values.version} required maxLength={50} />
      <SelectField
        name="status"
        label="Status"
        options={[
          { value: 'planned', label: 'Planned' },
          { value: 'released', label: 'Released' },
        ]}
        defaultValue={values.status}
      />
      <TextField name="targetDate" label="Target date" type="date" defaultValue={values.targetDate} />
      <TextField name="releasedOn" label="Released on" type="date" defaultValue={values.releasedOn} hint="Required when released." />
      <TextAreaField name="notes" label="Notes (Markdown)" defaultValue={values.notes} maxLength={20000} rows={6} />
      <CheckboxGroupField name="pullRequestIds" legend="Pull requests" options={pickers.pullRequests} defaultValues={values.pullRequestIds} />
    </>
  );
}

export function NewReleaseScreen({ projectId, pickers, create }: { readonly projectId: string; readonly pickers: Pickers; readonly create: FormAction }): React.JSX.Element {
  const blank: ReleaseFormValues = { version: '', status: 'planned', targetDate: '', releasedOn: '', notes: '', pullRequestIds: [] };
  return (
    <div>
      <PageHeader title="New release" actions={<Link href={projectHref(projectId, 'releases')}>Back to releases</Link>} />
      <Section title="Release">
        <ActionForm action={create} submitLabel="Create release" label="New release">
          <ReleaseFields pickers={pickers} values={blank} />
        </ActionForm>
      </Section>
    </div>
  );
}

export function ReleaseScreen({
  projectId,
  release,
  pickers,
  update,
  remove,
}: {
  readonly projectId: string;
  readonly release: ReleaseDetailVM;
  readonly pickers: Pickers;
  readonly update: FormAction;
  readonly remove: PlainAction;
}): React.JSX.Element {
  return (
    <div>
      <PageHeader
        title={release.version}
        description={
          <span className={styles.row}>
            <StatusTag status={release.status} />
            <span>{dates(release)}</span>
          </span>
        }
        actions={
          <>
            <Link href={projectHref(projectId, 'releases')}>Back to releases</Link>
            <ConfirmDialog
              action={remove}
              triggerLabel="Delete"
              title="Delete this release?"
              message="Notes attached to it are kept."
              confirmLabel="Delete release"
              fields={{ releaseId: release.id }}
            />
          </>
        }
      />
      <Section title="Pull requests">
        {release.pullRequests.length === 0 ? (
          <EmptyState>No pull requests linked.</EmptyState>
        ) : (
          <ul className={styles.list}>
            {release.pullRequests.map((pr) => (
              <li key={pr.id} className={styles.item}>
                <div className={styles.row}>
                  <ExternalLink href={pr.url}>
                    #{pr.number} {pr.title}
                  </ExternalLink>
                  <StatusTag status={pr.state} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Notes">
        {release.notesHtml === '' ? <p className="muted">No notes.</p> : <MarkdownView html={release.notesHtml} label="Release notes" />}
        {release.attachedNotes.length === 0 ? null : (
          <>
            <h3 className={styles.dayHeading}>Attached notes</h3>
            <ul>
              {release.attachedNotes.map((note) => (
                <li key={note.id}>
                  <Link href={projectItemHref(projectId, 'notes', note.id)}>{note.title}</Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
      <Section title="Edit">
        <ActionForm action={update} submitLabel="Save release" label="Edit release">
          <ReleaseFields pickers={pickers} values={release.form} />
        </ActionForm>
      </Section>
    </div>
  );
}
