import { AppLink as Link } from './app-link.tsx';
import type { FormAction, PlainAction } from '#src/ui/view-models/forms.ts';
import type { WorkloadVM } from '#src/ui/view-models/overview.ts';
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
        <ActionForm action={createArea} submitLabel="Add area" label="Add area" layout="row">
          <TextField name="name" label="New area name" hideLabel required maxLength={60} placeholder="New area, e.g. Backend" />
        </ActionForm>
        {active.length === 0 ? (
          <div className="mt-4">
            <EmptyState>No areas yet. Entries without an area appear under “General”.</EmptyState>
          </div>
        ) : (
          <div className={`${styles.tableWrap} mt-4`}>
            <table>
              <caption className="visually-hidden">Areas</caption>
              <thead>
                <tr>
                  <th scope="col">Area name</th>
                  <th scope="col" className="w-0">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {active.map((area) => (
                  <tr key={area.id}>
                    <td>
                      <ActionForm action={renameArea} submitLabel="Rename" label={`Rename ${area.name}`} layout="row" submitVariant="secondary">
                        <HiddenField name="areaId" value={area.id} />
                        <TextField name="name" label="Area name" hideLabel defaultValue={area.name} required maxLength={60} />
                      </ActionForm>
                    </td>
                    {/* A sibling cell, never inside the rename form: forms cannot nest. */}
                    <td className="text-right">
                      <ActionButton action={setAreaArchived} label="Archive" fields={{ areaId: area.id, archived: 'true' }} accessibleLabel={`Archive ${area.name}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
            <ArchivedTable
              caption="Archived areas"
              rows={archived.map((area) => ({ id: area.id, name: area.name }))}
              restore={(row) => (
                <ActionButton action={setAreaArchived} label="Restore" fields={{ areaId: row.id, archived: 'false' }} accessibleLabel={`Restore ${row.name}`} />
              )}
            />
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
/** BR-43: each person's recorded assignments across projects. */
function WorkloadTable({ workload }: { readonly workload: readonly WorkloadVM[] }): React.JSX.Element {
  if (workload.length === 0) {
    return <EmptyState>No people yet.</EmptyState>;
  }
  const cell = (value: number, tone?: 'danger' | 'warning'): React.JSX.Element =>
    value > 0 && tone !== undefined ? <StatusTag status={{ tone, label: String(value) }} /> : <span className="tabular-nums">{value}</span>;
  return (
    // Scrolls sideways on phones, so keyboard users must be able to reach it.
    <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Workload, scrollable">
      <table>
        <caption className="visually-hidden">Assignments per person across all active projects</caption>
        <thead>
          <tr>
            <th scope="col">Person</th>
            <th scope="col">Open plan items</th>
            <th scope="col">Open issues</th>
            <th scope="col">Overdue</th>
            <th scope="col">Blocked</th>
            <th scope="col">Done, last 30 days</th>
            <th scope="col">Projects</th>
          </tr>
        </thead>
        <tbody>
          {workload.map((person) => (
            <tr key={person.id}>
              <th scope="row">
                {person.name}
              </th>
              <td>{cell(person.openItems)}</td>
              <td>{cell(person.openIssues)}</td>
              <td>{cell(person.overdueItems + person.overdueIssues, 'danger')}</td>
              <td>{cell(person.blockedItems, 'warning')}</td>
              <td>{cell(person.doneRecently)}</td>
              <td className="text-muted">{person.projects.length === 0 ? 'None' : person.projects.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PeopleScreen({
  people,
  workload = [],
  create,
  rename,
  setArchived,
}: {
  readonly people: readonly PersonVM[];
  readonly workload?: readonly WorkloadVM[];
  readonly create: FormAction;
  readonly rename: FormAction;
  readonly setArchived: PlainAction;
}): React.JSX.Element {
  const active = people.filter((person) => !person.isArchived);
  const archived = people.filter((person) => person.isArchived);
  return (
    <div>
      <PageHeader title="People" description="Developer names used as labels across all projects." />
      <Section title="Workload">
        <p className="mb-3 text-sm text-muted">Assignments recorded in Worklog, across all active projects. A count of work, not a measure of anyone’s productivity.</p>
        <WorkloadTable workload={workload} />
      </Section>
      <Section title="People">
        <ActionForm action={create} submitLabel="Add person" label="Add person" layout="row">
          <TextField name="name" label="New person’s name" hideLabel required maxLength={80} placeholder="Add a person by name" />
        </ActionForm>
        {active.length === 0 ? (
          <div className="mt-4">
            <EmptyState>No people yet.</EmptyState>
          </div>
        ) : (
          <div className={`${styles.tableWrap} mt-4`}>
            <table>
              <caption className="visually-hidden">People</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col" className="w-0">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {active.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <ActionForm action={rename} submitLabel="Rename" label={`Rename ${person.name}`} layout="row" submitVariant="secondary">
                        <HiddenField name="personId" value={person.id} />
                        <TextField name="name" label="Name" hideLabel defaultValue={person.name} required maxLength={80} />
                      </ActionForm>
                    </td>
                    <td className="text-right">
                      <ActionButton action={setArchived} label="Archive" fields={{ personId: person.id, archived: 'true' }} accessibleLabel={`Archive ${person.name}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      {archived.length === 0 ? null : (
        <Section title="Archived">
          <ArchivedTable
            caption="Archived people"
            rows={archived.map((person) => ({ id: person.id, name: person.name }))}
            restore={(row) => (
              <ActionButton action={setArchived} label="Restore" fields={{ personId: row.id, archived: 'false' }} accessibleLabel={`Restore ${row.name}`} />
            )}
          />
        </Section>
      )}
    </div>
  );
}

/** Archived areas or people: a name and a Restore button per row. */
function ArchivedTable({
  caption,
  rows,
  restore,
}: {
  readonly caption: string;
  readonly rows: readonly { readonly id: string; readonly name: string }[];
  readonly restore: (row: { readonly id: string; readonly name: string }) => React.ReactNode;
}): React.JSX.Element {
  return (
    <div className={styles.tableWrap}>
      <table>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col" className="w-0">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="text-muted">{row.name}</td>
              <td className="text-right">{restore(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
      <Section title="Pull requests">
        <ActionForm action={add} submitLabel="Add" label="Add pull request" layout="row">
          <TextField name="url" label="Pull request link" hideLabel type="url" required placeholder="Paste a link: https://github.com/org/repo/pull/123" />
        </ActionForm>
        {pullRequests.length === 0 ? (
          <div className="mt-4">
            <EmptyState>No pull requests yet. Paste a link above or in the quick log.</EmptyState>
          </div>
        ) : (
          <div className={`${styles.tableWrap} mt-4`} tabIndex={0} role="region" aria-label="Pull requests, scrollable">
            <table>
              <caption className="visually-hidden">Pull requests of this project</caption>
              <thead>
                <tr>
                  <th scope="col">Pull request</th>
                  <th scope="col">Repository</th>
                  <th scope="col">State</th>
                  <th scope="col" className="w-0">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pullRequests.map((pr) => (
                  <tr key={pr.id}>
                    <td>
                      <ExternalLink href={pr.url}>
                        #{pr.number} {pr.title}
                      </ExternalLink>
                    </td>
                    <td className="whitespace-nowrap text-muted">
                      {pr.owner}/{pr.repo}
                    </td>
                    <td>
                      <StatusTag status={pr.state} />
                    </td>
                    <td>
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        <ActionButton action={refresh} label="Refresh" fields={{ pullRequestId: pr.id }} accessibleLabel={`Refresh from GitHub: #${String(pr.number)}`} />
                        <ConfirmDialog
                          action={remove}
                          triggerLabel="Delete"
                          title="Delete this pull request?"
                          message="Only possible when no entry, issue, release or note uses it."
                          confirmLabel="Delete"
                          fields={{ pullRequestId: pr.id }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
