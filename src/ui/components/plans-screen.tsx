import { AppLink as Link } from './app-link.tsx';
import type { Pickers } from '#src/ui/view-models/common.ts';
import type { FormAction, PlainAction } from '#src/ui/view-models/forms.ts';
import type { Horizon, PlansVM } from '#src/ui/view-models/plans.ts';
import { planExportHref, projectHref } from '#src/ui/routes.ts';
import { EmptyState } from './empty-state.tsx';
import { ActionForm, CheckboxGroupField, HiddenField, SelectField, TextAreaField, TextField } from './form.tsx';
import { PageHeader, Section } from './page-header.tsx';
import { PlanItemList } from './plan-item-list.tsx';
import { lists as styles } from './lists.ts';

const horizons: readonly { readonly value: Horizon; readonly label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/**
 * BR-47: download the week or month plan as PDF or Markdown. A native disclosure, so it
 * works without JavaScript; the downloads are plain links to a GET route.
 */
function ExportMenu({ projectId, exports }: { readonly projectId: string; readonly exports: PlansVM['exports'] }): React.JSX.Element {
  return (
    <details className="relative">
      <summary className="button cursor-pointer list-none [&::-webkit-details-marker]:hidden" data-size="small">
        Export plan
      </summary>
      <div className="absolute right-0 z-20 mt-2 grid w-72 gap-3 rounded-lg border border-line bg-surface p-4 shadow-lg">
        {exports.map((item) => (
          <div key={item.kind} className="grid gap-1.5">
            <p className="text-sm font-semibold">
              {item.kind === 'weekly' ? 'Week' : 'Month'}: {item.label}
            </p>
            <div className="flex gap-2">
              <a
                className="button"
                data-size="small"
                data-variant="primary"
                href={planExportHref(projectId, item.kind, item.start, 'pdf')}
                aria-label={`PDF of the ${item.kind === 'weekly' ? 'week' : 'month'} plan`}
                download
              >
                PDF
              </a>
              <a
                className="button"
                data-size="small"
                href={planExportHref(projectId, item.kind, item.start, 'md')}
                aria-label={`Markdown of the ${item.kind === 'weekly' ? 'week' : 'month'} plan`}
                download
              >
                Markdown
              </a>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

/** Product spec §6: day / week / month plans; add items; change status; move with history. */
export function PlansScreen({
  projectId,
  vm,
  pickers,
  createItem,
  setStatus,
}: {
  readonly projectId: string;
  readonly vm: PlansVM;
  readonly pickers: Pickers;
  readonly createItem: FormAction;
  readonly setStatus: PlainAction;
}): React.JSX.Element {
  return (
    <div>
      <PageHeader title="Plans" actions={<ExportMenu projectId={projectId} exports={vm.exports} />} />
      <div className={styles.toolbar}>
        <nav aria-label="Plan horizon" className={styles.tabs}>
          {horizons.map((horizon) => (
            <Link
              key={horizon.value}
              className={styles.tab}
              href={projectHref(projectId, 'plans', `horizon=${horizon.value}&date=${vm.periodStart}`)}
              aria-current={vm.horizon === horizon.value ? 'page' : undefined}
            >
              {horizon.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Plan period" className={styles.row}>
          <Link className="button" data-size="small" href={projectHref(projectId, 'plans', vm.previousQuery)}>
            ← Previous
          </Link>
          <Link className="button" data-size="small" href={projectHref(projectId, 'plans', vm.currentQuery)}>
            Current
          </Link>
          <Link className="button" data-size="small" href={projectHref(projectId, 'plans', vm.nextQuery)}>
            Next →
          </Link>
        </nav>
      </div>
      <Section title={vm.label}>
        {vm.days === null ? (
          <PlanItemList
            items={vm.items}
            projectId={projectId}
            setStatus={setStatus}
            empty={vm.alsoDue.length > 0 ? 'Nothing on this plan itself.' : 'Nothing planned for this period yet.'}
          />
        ) : (
          // Week plans read day by day, Monday to Friday.
          vm.days.map((day) => (
            <div key={day.date} className={styles.weekDay}>
              <h3 className={styles.weekDayHeading}>{day.label}</h3>
              {day.items.length === 0 ? (
                <p className={styles.weekDayEmpty}>Nothing due.</p>
              ) : (
                <PlanItemList items={day.items} projectId={projectId} setStatus={setStatus} />
              )}
            </div>
          ))
        )}
        {/* BR-49: what the longer plans have due in this period. */}
        {vm.alsoDue.map((group) => (
          <div key={group.heading} className={styles.weekDay}>
            <h3 className={styles.weekDayHeading}>{group.heading}</h3>
            <PlanItemList items={group.items} projectId={projectId} setStatus={setStatus} />
          </div>
        ))}
      </Section>
      <Section title="Add to this plan">
        {vm.canAdd ? (
          <ActionForm action={createItem} submitLabel="Add item" label="Add plan item">
            <HiddenField name="horizon" value={vm.horizon} />
            <HiddenField name="periodStart" value={vm.periodStart} />
            <TextField name="title" label="Title" required maxLength={300} wide />
            <TextAreaField name="description" label="Description" maxLength={2000} rows={2} hint="Optional. What the item means or what done looks like." />
            <TextField name="dueDate" label="Due date" type="date" defaultValue={vm.defaultDueDate} min={vm.periodStart} max={vm.periodEnd} required />
            <SelectField name="areaId" label="Area" options={pickers.areas} emptyLabel="General (no area)" />
            <SelectField name="issueId" label="Issue" options={pickers.issues} emptyLabel="None" />
            <CheckboxGroupField name="personIds" legend="Assignees" options={pickers.people} />
          </ActionForm>
        ) : (
          <EmptyState>Day plans cover working days only. Pick a weekday to plan.</EmptyState>
        )}
      </Section>
    </div>
  );
}
