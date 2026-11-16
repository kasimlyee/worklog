import { AppLink as Link } from './app-link.tsx';
import { changesTitle, numberedChanges, splitEntryText, type NumberedChange, type NoteRow } from '#src/lib/entry-text.ts';
import type { Pickers } from '#src/ui/view-models/common.ts';
import type { EntryFormValues, EntryVM, LogVM } from '#src/ui/view-models/entries.ts';
import type { FormAction, PlainAction } from '#src/ui/view-models/forms.ts';
import { projectHref, projectItemHref } from '#src/ui/routes.ts';
import { ConfirmDialog } from './confirm-dialog.tsx';
import { EmptyState } from './empty-state.tsx';
import { EntryForm, OpenQuickLog } from './entry-form.tsx';
import { EntrySummaryRow, changeRows, entryHref } from './entry-summary.tsx';
import { ExternalLink } from './external-link.tsx';
import { PageHeader, Section } from './page-header.tsx';
import { PersonList } from './person-list.tsx';
import { StatusTag } from './status-tag.tsx';

const smallLabel = 'font-mono text-xs font-medium tracking-wide text-muted uppercase';

function FilterSelect({
  name,
  label,
  options,
  value,
  wide = false,
}: {
  readonly name: string;
  readonly label: string;
  readonly options: Pickers['areas'];
  readonly value: string;
  readonly wide?: boolean;
}): React.JSX.Element {
  return (
    <div className={`grid gap-1 ${wide ? 'w-full sm:w-56' : 'w-[calc(50%-0.375rem)] sm:w-40'}`}>
      <label htmlFor={`filter-${name}`} className="text-sm">
        {label}
      </label>
      <select id={`filter-${name}`} name={name} defaultValue={value}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The entry's title: the names of its numbered changes, its own words, or — for notes-only entries — the first note. */
function headline(entry: EntryVM): string {
  const changes = numberedChanges(entry.description);
  if (changes.length > 0) {
    return changesTitle(changes);
  }
  const text = splitEntryText(entry.description);
  return text.lead !== '' ? text.lead : (text.notes[0]?.text ?? entry.description);
}

/*
 * Wording fits bugs and features alike: a plan item is often new work, not a fault.
 * What (the issue or need), Why (its cause or reason), Change (the fix or what was built).
 */
function ChangeTable({ rows }: { readonly rows: readonly NoteRow[] }): React.JSX.Element {
  return (
    <>
      {/* On a phone each row stacks as labelled lines; from tablet width it is a table. */}
      <dl className="grid gap-3 sm:hidden">
        {rows.map((row, index) => (
          <div key={String(index)} className="grid gap-1.5 rounded-md border border-line p-3 text-sm">
            {(['What', 'Why', 'Change'] as const).map((label) => {
              const value = label === 'What' ? row.issue : label === 'Why' ? row.cause : row.fix;
              return value === '' ? null : (
                <div key={label} className="grid gap-0.5">
                  <dt className={smallLabel}>{label}</dt>
                  <dd className={label === 'What' ? 'font-semibold' : ''}>{value}</dd>
                </div>
              );
            })}
          </div>
        ))}
      </dl>
      <ChangeTableWide rows={rows} />
    </>
  );
}

function ChangeTableWide({ rows }: { readonly rows: readonly NoteRow[] }): React.JSX.Element {
  return (
    <div className="relative hidden overflow-x-auto rounded-md border border-line sm:block" tabIndex={0} role="region" aria-label="What changed and why, scrollable">
      <table className="min-w-[30rem]">
        <caption className="visually-hidden">What changed and why</caption>
        <thead>
          <tr>
            <th scope="col" className="w-1/3 pl-3!">
              What
            </th>
            <th scope="col" className="w-1/3">
              Why
            </th>
            <th scope="col" className="w-1/3 pr-3!">
              Change
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(index)} className="align-top [&>td]:align-top">
              <td className="pl-3! font-semibold">{row.issue === '' ? '—' : row.issue}</td>
              <td>{row.cause === '' ? <span className="text-muted">—</span> : row.cause}</td>
              <td className="pr-3!">{row.fix === '' ? <span className="text-muted">—</span> : row.fix}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A pasted summary of finished work, one row per numbered change. */
function DoneTable({ changes }: { readonly changes: readonly NumberedChange[] }): React.JSX.Element {
  return (
    <div className="relative overflow-x-auto rounded-md border border-line" tabIndex={0} role="region" aria-label="What was done, scrollable">
      <table className="min-w-[24rem]">
        <caption className="visually-hidden">What was done</caption>
        <thead>
          <tr>
            <th scope="col" className="w-1/3 pl-3!">
              Change
            </th>
            <th scope="col" className="pr-3!">
              What was done
            </th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change, index) => (
            <tr key={String(index)} className="[&>td]:align-top">
              <td className="pl-3! font-semibold">{change.name}</td>
              <td className="pr-3!">{change.text === '' ? <span className="text-muted">—</span> : change.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A plan item's name, with the meaning after " — " underneath. */
function PlanItemName({ title }: { readonly title: string }): React.JSX.Element {
  const split = title.indexOf(' — ');
  return split === -1 ? (
    <>{title}</>
  ) : (
    <span className="grid">
      <span>{title.slice(0, split)}</span>
      <span className="text-xs text-muted">{title.slice(split + 3)}</span>
    </span>
  );
}

/** The selected entry in full: what was done, its fixes, PRs, what it closed and its plan items. */
function EntryDetail({ entry, projectId }: { readonly entry: EntryVM; readonly projectId: string }): React.JSX.Element {
  const rows = changeRows(entry);
  const done = numberedChanges(entry.description);
  return (
    <article className="grid content-start gap-5 p-5 sm:p-6" aria-labelledby="entry-title" id="entry">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
        <span>{entry.dateLabel}</span>
        {entry.isWeekend ? <StatusTag status={{ tone: 'neutral', label: 'Weekend' }} /> : null}
        <span>{entry.area ?? 'General'}</span>
        <PersonList people={entry.people} />
        <Link className="ml-auto" href={projectItemHref(projectId, 'log', entry.id, 'edit')} aria-label={`Edit entry: ${headline(entry)}`}>
          Edit
        </Link>
      </div>
      <h2 id="entry-title" className="text-xl leading-snug tracking-tight wrap-anywhere">
        {headline(entry)}
      </h2>
      {done.length === 0 ? null : <DoneTable changes={done} />}
      {rows.length === 0 ? null : <ChangeTable rows={rows} />}
      {entry.pullRequests.length === 0 ? null : (
        <section className="grid gap-2" aria-label="Pull requests">
          <h3 className={smallLabel}>Pull requests</h3>
          <ul className="grid list-none gap-1.5">
            {entry.pullRequests.map((pr) => (
              <li key={pr.id} className="flex items-start gap-2">
                <ExternalLink href={pr.url}>
                  {pr.repo} #{pr.number} {pr.title}
                </ExternalLink>
                <StatusTag status={pr.state} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {entry.issues.length === 0 && entry.planItems.length === 0 ? null : (
        <div className="grid gap-4 sm:grid-cols-2">
          {entry.issues.length === 0 ? null : (
            <section className="grid content-start gap-2" aria-label="Issues">
              <h3 className={smallLabel}>Issues</h3>
              <ul className="grid list-none gap-1.5">
                {entry.issues.map((issue) => (
                  <li key={issue.id} className="flex flex-wrap items-center gap-2">
                    <Link href={projectItemHref(projectId, 'issues', issue.id)}>{issue.title}</Link>
                    {issue.resolves ? <StatusTag status={{ tone: 'success', label: 'Fixed' }} /> : null}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {entry.planItems.length === 0 ? null : (
            <section className="grid content-start gap-2" aria-label="Plan items">
              <h3 className={smallLabel}>Plan items</h3>
              <ul className="grid list-none gap-1.5">
                {entry.planItems.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-2">
                    <Link href={projectItemHref(projectId, 'plans/items', item.id)}>
                      <PlanItemName title={item.title} />
                    </Link>
                    {item.completes ? <StatusTag status={{ tone: 'success', label: 'Finished' }} /> : null}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </article>
  );
}

/** Product spec §6, option B: entries by date in a list beside the selected entry in full; search and filters. */
export function LogScreen({ projectId, vm, pickers }: { readonly projectId: string; readonly vm: LogVM; readonly pickers: Pickers }): React.JSX.Element {
  const selectedId = vm.selected?.id ?? null;
  return (
    <div>
      <PageHeader
        title="Log"
        actions={
          <>
            <OpenQuickLog />
            <Link href={projectHref(projectId, 'pull-requests')}>Pull requests</Link>
          </>
        }
      />
      {/* A GET form: search and filters live in the URL and work without JavaScript. */}
      <form method="get" className="mb-4 flex flex-wrap items-end gap-x-3 gap-y-2" aria-label="Filter entries">
        <div className="grid min-w-0 flex-[1_1_16rem] gap-1">
          <label htmlFor="filter-q" className="text-sm">
            Search
          </label>
          <input id="filter-q" name="q" type="search" defaultValue={vm.filters.q} maxLength={100} placeholder="Work, causes, fixes, issues, PRs" />
        </div>
        <FilterSelect name="areaId" label="Area" options={pickers.areas} value={vm.filters.areaId} />
        <FilterSelect name="personId" label="Person" options={pickers.people} value={vm.filters.personId} />
        <FilterSelect name="pullRequestId" label="Pull request" options={pickers.pullRequests} value={vm.filters.pullRequestId} wide />
        {/* Carried along, so narrowing further keeps the issue or plan item the page was opened for. */}
        {vm.filters.issueId === '' ? null : <input type="hidden" name="issueId" value={vm.filters.issueId} />}
        {vm.filters.planItemId === '' ? null : <input type="hidden" name="planItemId" value={vm.filters.planItemId} />}
        <button type="submit">Search</button>
        {vm.isFiltered ? <Link href={projectHref(projectId, 'log')}>Clear filters</Link> : null}
      </form>
      {vm.filters.issueId === '' && vm.filters.planItemId === '' ? null : (
        <p className="mb-4 rounded-md bg-accent-soft px-3 py-2 text-sm" role="status">
          Showing only the work linked to {vm.filters.issueId === '' ? 'one plan item' : 'one issue'}.
        </p>
      )}
      {vm.days.length === 0 ? (
        <EmptyState>{vm.isFiltered ? 'No entries match these filters.' : 'No work logged yet.'}</EmptyState>
      ) : (
        <section aria-label="Entries">
          <div className="grid overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <nav
              aria-label="Entries by day"
              className={`border-line lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:border-r ${vm.isSelectionExplicit ? 'order-2 border-t lg:order-none lg:border-t-0' : 'border-b lg:border-b-0'}`}
            >
              {vm.days.map((day) => (
                <div key={day.date}>
                  <h2 className={`sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-sunken px-4 py-2 ${smallLabel}`}>
                    {day.label}
                    {day.isWeekend ? <StatusTag status={{ tone: 'neutral', label: 'Weekend' }} /> : null}
                  </h2>
                  <ul className="list-none">
                    {day.entries.map((entry) => (
                      <li key={entry.id} className="border-b border-line last:border-b-0">
                        <EntrySummaryRow entry={entry} href={entryHref(projectId, vm.listQuery, entry.id)} current={entry.id === selectedId} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {vm.nextPageQuery === null ? null : (
                <p className="border-t border-line p-4">
                  <Link className="button" data-size="small" href={projectHref(projectId, 'log', vm.nextPageQuery)}>
                    Older entries
                  </Link>
                </p>
              )}
            </nav>
            {vm.selected === null ? null : <EntryDetail entry={vm.selected} projectId={projectId} />}
          </div>
        </section>
      )}
    </div>
  );
}

export function EntryEditScreen({
  projectId,
  values,
  pickers,
  update,
  remove,
  entryId,
}: {
  readonly projectId: string;
  readonly entryId: string;
  readonly values: EntryFormValues;
  readonly pickers: Pickers;
  readonly update: FormAction;
  readonly remove: PlainAction;
}): React.JSX.Element {
  return (
    <div>
      <PageHeader
        title="Edit entry"
        actions={
          <>
            <Link href={projectHref(projectId, 'log', `entry=${entryId}`)}>Back to log</Link>
            <ConfirmDialog
              action={remove}
              triggerLabel="Delete"
              title="Delete this entry?"
              message="It disappears from the log and from every report."
              confirmLabel="Delete entry"
              fields={{ entryId }}
            />
          </>
        }
      />
      <Section title="Entry">
        <EntryForm action={update} pickers={pickers} values={values} submitLabel="Save entry" label="Edit entry" />
      </Section>
    </div>
  );
}
