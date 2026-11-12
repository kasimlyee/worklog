import { AppLink as Link } from './app-link.tsx';
import type { Pickers } from '#src/ui/view-models/common.ts';
import type { FormAction, PlainAction } from '#src/ui/view-models/forms.ts';
import type { NoteFormValues, NoteVM } from '#src/ui/view-models/notes.ts';
import { newItemHref, projectHref, projectItemHref } from '#src/ui/routes.ts';
import { ConfirmDialog } from './confirm-dialog.tsx';
import { EmptyState } from './empty-state.tsx';
import { ExternalLink } from './external-link.tsx';
import { ActionForm, SelectField, TextAreaField, TextField } from './form.tsx';
import { MarkdownView } from './markdown-view.tsx';
import { PageHeader, Section } from './page-header.tsx';
import { lists as styles } from './lists.ts';

export function NotesScreen({ projectId, notes }: { readonly projectId: string; readonly notes: readonly NoteVM[] }): React.JSX.Element {
  return (
    <div>
      <PageHeader
        title="Notes"
        actions={
          <Link className="button" data-variant="primary" href={newItemHref(projectId, 'notes')}>
            New note
          </Link>
        }
      />
      <Section title="All notes">
        {notes.length === 0 ? (
          <EmptyState>No notes yet.</EmptyState>
        ) : (
          <ul className={styles.list}>
            {notes.map((note) => (
              <li key={note.id} className={styles.item}>
                <Link className={styles.title} href={projectItemHref(projectId, 'notes', note.id)}>
                  {note.title}
                </Link>
                <div className={styles.meta}>
                  <span>Updated {note.updatedLabel}</span>
                  {note.release === null ? null : <span>Release {note.release.version}</span>}
                  {note.pullRequest === null ? null : <span>PR #{note.pullRequest.number}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export function NoteScreen({ projectId, note, remove }: { readonly projectId: string; readonly note: NoteVM; readonly remove: PlainAction }): React.JSX.Element {
  return (
    <div>
      <PageHeader
        title={note.title}
        description={`Updated ${note.updatedLabel}`}
        actions={
          <>
            <Link href={projectHref(projectId, 'notes')}>All notes</Link>
            <Link className="button" data-size="small" href={projectItemHref(projectId, 'notes', note.id, 'edit')}>
              Edit
            </Link>
            <ConfirmDialog
              action={remove}
              triggerLabel="Delete"
              title="Delete this note?"
              message="This cannot be undone."
              confirmLabel="Delete note"
              fields={{ noteId: note.id }}
            />
          </>
        }
      />
      <Section title="Note">
        {note.bodyHtml === '' ? <p className="muted">This note is empty.</p> : <MarkdownView html={note.bodyHtml} label="Note body" />}
      </Section>
      {note.links.length > 0 || note.release !== null || note.pullRequest !== null ? (
        <Section title="Links">
          <ul className="list-disc pl-6">
            {note.release === null ? null : (
              <li>
                Release <Link href={projectItemHref(projectId, 'releases', note.release.id)}>{note.release.version}</Link>
              </li>
            )}
            {note.pullRequest === null ? null : (
              <li>
                <ExternalLink href={note.pullRequest.url}>
                  #{note.pullRequest.number} {note.pullRequest.title}
                </ExternalLink>
              </li>
            )}
            {note.links.map((link) => (
              <li key={`${link.label}-${link.url}`}>
                <ExternalLink href={link.url}>{link.label}</ExternalLink>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

/** Existing links plus two blank rows; blank rows are ignored when saved. */
export function NoteEditScreen({
  projectId,
  title,
  values,
  pickers,
  save,
  backHref,
}: {
  readonly projectId: string;
  readonly title: string;
  readonly values: NoteFormValues;
  readonly pickers: Pickers;
  readonly save: FormAction;
  readonly backHref?: ReturnType<typeof projectHref>;
}): React.JSX.Element {
  const rows = [...values.links, { label: '', url: '' }, { label: '', url: '' }];
  return (
    <div>
      <PageHeader title={title} actions={<Link href={backHref ?? projectHref(projectId, 'notes')}>Cancel</Link>} />
      <Section title="Note">
        <ActionForm action={save} submitLabel="Save note" label={title}>
          <TextField name="title" label="Title" defaultValue={values.title} required maxLength={200} wide />
          <TextAreaField name="body" label="Body (Markdown)" defaultValue={values.body} maxLength={50000} rows={14} hint="Raw HTML is shown as text." />
          <SelectField name="releaseId" label="Release" options={pickers.releases} defaultValue={values.releaseId} emptyLabel="None" />
          <SelectField name="pullRequestId" label="Pull request" options={pickers.pullRequests} defaultValue={values.pullRequestId} emptyLabel="None" />
          {rows.map((link, index) => (
            <fieldset key={String(index)} className={styles.row} aria-label={`Link ${String(index + 1)}`}>
              <TextField name={`links.${String(index)}.label`} label={`Link ${String(index + 1)} label`} defaultValue={link.label} maxLength={120} />
              <TextField name={`links.${String(index)}.url`} label={`Link ${String(index + 1)} URL`} type="url" defaultValue={link.url} />
            </fieldset>
          ))}
        </ActionForm>
      </Section>
    </div>
  );
}
