import { AppLink as Link } from './app-link.tsx';
import type { Pickers } from '#src/ui/view-models/common.ts';
import type { FormAction, PlainAction } from '#src/ui/view-models/forms.ts';
import type { Horizon, PlansVM } from '#src/ui/view-models/plans.ts';
import { projectHref } from '#src/ui/routes.ts';
import { EmptyState } from './empty-state.tsx';
import { ActionForm, CheckboxGroupField, HiddenField, SelectField, TextField } from './form.tsx';
import { PageHeader, Section } from './page-header.tsx';
import { PlanItemList } from './plan-item-list.tsx';
import { lists as styles } from './lists.ts';

const horizons: readonly { readonly value: Horizon; readonly label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

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
      <PageHeader title="Plans" />
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
          <PlanItemList items={vm.items} projectId={projectId} setStatus={setStatus} empty="Nothing planned for this period yet." />
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
      </Section>
      <Section title="Add to this plan">
        {vm.canAdd ? (
          <ActionForm action={createItem} submitLabel="Add item" label="Add plan item">
            <HiddenField name="horizon" value={vm.horizon} />
            <HiddenField name="periodStart" value={vm.periodStart} />
            <TextField name="title" label="Title" required maxLength={300} wide />
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
