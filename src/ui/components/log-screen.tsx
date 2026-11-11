import Link from 'next/link';
import type { Pickers } from '#src/ui/view-models/common.ts';
import type { EntryFormValues, LogVM } from '#src/ui/view-models/entries.ts';
import type { FormAction, PlainAction } from '#src/ui/view-models/forms.ts';
import { projectHref } from '#src/ui/routes.ts';
import { ConfirmDialog } from './confirm-dialog.tsx';
import { EmptyState } from './empty-state.tsx';
import { EntryForm } from './entry-form.tsx';
import { EntryList } from './entry-list.tsx';
import { PageHeader, Section } from './page-header.tsx';
import { StatusTag } from './status-tag.tsx';
import styles from './lists.module.css';

function FilterSelect({ name, label, options, value }: { readonly name: string; readonly label: string; readonly options: Pickers['areas']; readonly value: string }): React.JSX.Element {
  return (
    <div>
      <label htmlFor={`filter-${name}`}>{label}</label>
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

/** Product spec §6: entries by date, newest first; quick add; filter by area, person, PR. */
export function LogScreen({
  projectId,
  vm,
  pickers,
  createEntry,
  today,
}: {
  readonly projectId: string;
  readonly vm: LogVM;
  readonly pickers: Pickers;
  readonly createEntry: FormAction;
  readonly today: string;
}): React.JSX.Element {
  const blank: EntryFormValues = { workDate: today, description: '', areaId: '', personIds: [], prUrl: '', planItemId: '', issueId: '' };
  return (
    <div>
      <PageHeader title="Log" actions={<Link href={projectHref(projectId, 'pull-requests')}>Pull requests</Link>} />
      <Section title="Log work">
        <EntryForm action={createEntry} pickers={pickers} values={blank} submitLabel="Log work" label="Log work" />
      </Section>
      <Section title="Entries">
        {/* A GET form: filters live in the URL and work without JavaScript. */}
        <form method="get" className={styles.toolbar} aria-label="Filter entries">
          <FilterSelect name="areaId" label="Area" options={pickers.areas} value={vm.filters.areaId} />
          <FilterSelect name="personId" label="Person" options={pickers.people} value={vm.filters.personId} />
          <FilterSelect name="pullRequestId" label="Pull request" options={pickers.pullRequests} value={vm.filters.pullRequestId} />
          <button type="submit" data-size="small">
            Filter
          </button>
          {vm.isFiltered ? <Link href={projectHref(projectId, 'log')}>Clear filters</Link> : null}
        </form>
        {vm.days.length === 0 ? <EmptyState>{vm.isFiltered ? 'No entries match these filters.' : 'No work logged yet.'}</EmptyState> : null}
        {vm.days.map((day) => (
          <div key={day.date}>
            <h3 className={styles.dayHeading}>
              {day.label}
              {day.isWeekend ? <StatusTag status={{ tone: 'neutral', label: 'Weekend' }} /> : null}
            </h3>
            <EntryList entries={day.entries} projectId={projectId} showDate={false} />
          </div>
        ))}
        {vm.nextPageQuery === null ? null : (
          <p>
            <Link className="button" href={projectHref(projectId, 'log', vm.nextPageQuery)}>
              Older entries
            </Link>
          </p>
        )}
      </Section>
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
            <Link href={projectHref(projectId, 'log')}>Back to log</Link>
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
