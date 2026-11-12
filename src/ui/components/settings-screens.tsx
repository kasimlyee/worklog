import { AppLink as Link } from './app-link.tsx';
import type { FormAction, PlainAction } from '#src/ui/view-models/forms.ts';
import type { PersonVM, PullRequestRowVM, SettingsVM } from '#src/ui/view-models/settings.ts';
import { ActionButton } from './action-button.tsx';
import { AreaReorder } from './area-reorder.tsx';
import { ConfirmDialog } from './confirm-dialog.tsx';
import { EmptyState } from './empty-state.tsx';
import { ExternalLink } from './external-link.tsx';
import { ActionForm, HiddenField, TextAreaField, TextField } from './form.tsx';
import { PageHeader, Section } from './page-header.tsx';
import { StatusTag } from './status-tag.tsx';
import { projectHref } from '#src/ui/routes.ts';
import { lists as styles } from './lists.ts';

/** Product spec §6: name, description, areas (add, rename, reorder, archive), archive project. */
export function SettingsScreen({
  vm,
  updateProject,
  createArea,
  renameArea,
  setAreaArchived,
  reorderAreas,
  setProjectArchived,
}: {
  readonly vm: SettingsVM;
  readonly updateProject: FormAction;
  readonly createArea: FormAction;
  readonly renameArea: FormAction;
  readonly setAreaArchived: PlainAction;
  readonly reorderAreas: FormAction;
  readonly setProjectArchived: PlainAction;
}): React.JSX.Element {
  const active = vm.areas.filter((area) => !area.isArchived);
  const archived = vm.areas.filter((area) => area.isArchived);
  return (
    <div>
      <PageHeader title="Settings" />
      <Section title="Project">
        <ActionForm action={updateProject} submitLabel="Save project" label="Project details">
          <TextField name="name" label="Name" defaultValue={vm.project.name} required maxLength={120} />
          <TextAreaField name="description" label="Description" defaultValue={vm.project.description} maxLength={2000} rows={2} />
        </ActionForm>
      </Section>
      <Section title="Areas">
        {active.length === 0 ? <EmptyState>No areas yet. Entries without an area appear under “General”.</EmptyState> : null}
        <ul className={styles.list}>
          {active.map((area) => (
            <li key={area.id} className={styles.item}>
              <ActionForm action={renameArea} submitLabel="Rename" label={`Rename ${area.name}`} layout="inline">
                <HiddenField name="areaId" value={area.id} />
                <TextField name="name" label="Area name" defaultValue={area.name} required maxLength={60} />
              </ActionForm>
              {/* A sibling, never inside the rename form: forms cannot nest. */}
              <div className={styles.actions}>
                <ActionButton action={setAreaArchived} label="Archive" fields={{ areaId: area.id, archived: 'true' }} accessibleLabel={`Archive ${area.name}`} />
              </div>
            </li>
          ))}
        </ul>
        <h3 className={styles.dayHeading}>Add an area</h3>
        <ActionForm action={createArea} submitLabel="Add area" label="Add area" layout="inline">
          <TextField name="name" label="Area name" required maxLength={60} />
        </ActionForm>
        {active.length > 1 ? (
          <>
            <h3 className={styles.dayHeading}>Order in reports</h3>
            {/* Keyed by which areas exist (not their order): adding or archiving one resets the list. */}
            <AreaReorder key={active.map((area) => area.id).sort().join(',')} areas={active} reorder={reorderAreas} />
          </>
        ) : null}
        {archived.length === 0 ? null : (
          <>
            <h3 className={styles.dayHeading}>Archived areas</h3>
            <ul className={styles.list}>
              {archived.map((area) => (
                <li key={area.id} className={styles.item}>
                  <div className={styles.row}>
                    <span>{area.name}</span>
                    <ActionButton action={setAreaArchived} label="Restore" fields={{ areaId: area.id, archived: 'false' }} accessibleLabel={`Restore ${area.name}`} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
      <Section title={vm.project.isArchived ? 'Restore project' : 'Archive project'}>
        {vm.project.isArchived ? (
          <ActionButton action={setProjectArchived} label="Restore project" fields={{ archived: 'false' }} />
        ) : (
          <>
            <p className="muted">Archived projects leave the project list. Their history and reports stay available.</p>
            <ConfirmDialog
              action={setProjectArchived}
              triggerLabel="Archive project"
              title="Archive this project?"
              message="It leaves the project list. Nothing is deleted."
              confirmLabel="Archive"
              fields={{ archived: 'true' }}
            />
          </>
        )}
      </Section>
    </div>
  );
}

/** Product spec §6: people are global labels — add, rename, archive. */
export function PeopleScreen({
  people,
  create,
  rename,
  setArchived,
}: {
  readonly people: readonly PersonVM[];
  readonly create: FormAction;
  readonly rename: FormAction;
  readonly setArchived: PlainAction;
}): React.JSX.Element {
  const active = people.filter((person) => !person.isArchived);
  const archived = people.filter((person) => person.isArchived);
  return (
    <div>
      <PageHeader title="People" description="Developer names used as labels across all projects." />
      <Section title="Add a person">
        <ActionForm action={create} submitLabel="Add person" label="Add person" layout="inline">
          <TextField name="name" label="Name" required maxLength={80} />
        </ActionForm>
      </Section>
      <Section title="People">
        {active.length === 0 ? <EmptyState>No people yet.</EmptyState> : null}
        <ul className={styles.list}>
          {active.map((person) => (
            <li key={person.id} className={styles.item}>
              <ActionForm action={rename} submitLabel="Rename" label={`Rename ${person.name}`} layout="inline">
                <HiddenField name="personId" value={person.id} />
                <TextField name="name" label="Name" defaultValue={person.name} required maxLength={80} />
              </ActionForm>
              <div className={styles.actions}>
                <ActionButton action={setArchived} label="Archive" fields={{ personId: person.id, archived: 'true' }} accessibleLabel={`Archive ${person.name}`} />
              </div>
            </li>
          ))}
        </ul>
      </Section>
      {archived.length === 0 ? null : (
        <Section title="Archived">
          <ul className={styles.list}>
            {archived.map((person) => (
              <li key={person.id} className={styles.item}>
                <div className={styles.row}>
                  <span>{person.name}</span>
                  <ActionButton action={setArchived} label="Restore" fields={{ personId: person.id, archived: 'false' }} accessibleLabel={`Restore ${person.name}`} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

/** BR-21…BR-26, BR-36: pull requests of a project — add by link, refresh, delete if unused. */
export function PullRequestsScreen({
  projectId,
  pullRequests,
  notice = null,
  add,
  refresh,
  remove,
}: {
  readonly projectId: string;
  readonly pullRequests: readonly PullRequestRowVM[];
  /** A message from the last one-click action, if it failed. */
  readonly notice?: string | null;
  readonly add: FormAction;
  readonly refresh: PlainAction;
  readonly remove: PlainAction;
}): React.JSX.Element {
  return (
    <div>
      <PageHeader title="Pull requests" actions={<Link href={projectHref(projectId, 'log')}>Back to log</Link>} />
      {notice === null ? null : (
        <p className={styles.notice} role="alert">
          {notice}
        </p>
      )}
      <Section title="Add a pull request">
        <ActionForm action={add} submitLabel="Add" label="Add pull request" layout="inline">
          <TextField name="url" label="Pull request link" type="url" required placeholder="https://github.com/org/repo/pull/123" wide />
        </ActionForm>
      </Section>
      <Section title="Pull requests">
        {pullRequests.length === 0 ? (
          <EmptyState>No pull requests yet. Paste a link above or in the quick log.</EmptyState>
        ) : (
          <ul className={styles.list}>
            {pullRequests.map((pr) => (
              <li key={pr.id} className={styles.item}>
                <div className={styles.row}>
                  <ExternalLink href={pr.url}>
                    {pr.owner}/{pr.repo} #{pr.number} {pr.title}
                  </ExternalLink>
                  <StatusTag status={pr.state} />
                </div>
                <div className={styles.actions}>
                  <ActionButton action={refresh} label="Refresh from GitHub" fields={{ pullRequestId: pr.id }} accessibleLabel={`Refresh from GitHub: #${String(pr.number)}`} />
                  <ConfirmDialog
                    action={remove}
                    triggerLabel="Delete"
                    title="Delete this pull request?"
                    message="Only possible when no entry, issue, release or note uses it."
                    confirmLabel="Delete"
                    fields={{ pullRequestId: pr.id }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
