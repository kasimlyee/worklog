import Link from 'next/link';
import type { Pickers } from '#src/ui/view-models/common.ts';
import type { FormAction, PlainAction } from '#src/ui/view-models/forms.ts';
import type { PlanItemDetailVM } from '#src/ui/view-models/plans.ts';
import { projectHref } from '#src/ui/routes.ts';
import { ConfirmDialog } from './confirm-dialog.tsx';
import { ActionForm, CheckboxGroupField, SelectField, TextField } from './form.tsx';
import { PageHeader, Section } from './page-header.tsx';
import { PersonList } from './person-list.tsx';
import { StatusForm } from './plan-item-list.tsx';
import { DeadlineLabel, StatusTag } from './status-tag.tsx';
import styles from './lists.module.css';

/** One plan item: details, status, carry-over (BR-15) with its history, edit and delete. */
export function PlanItemScreen({
  projectId,
  item,
  pickers,
  update,
  move,
  setStatus,
  remove,
}: {
  readonly projectId: string;
  readonly item: PlanItemDetailVM;
  readonly pickers: Pickers;
  readonly update: FormAction;
  readonly move: FormAction;
  readonly setStatus: PlainAction;
  readonly remove: PlainAction;
}): React.JSX.Element {
  return (
    <div>
      <PageHeader
        title={item.title}
        description={
          <span className={styles.row}>
            <span>{item.planLabel}</span>
            <StatusTag status={item.statusTag} />
            {item.deadline === null ? null : <DeadlineLabel status={item.deadline} />}
          </span>
        }
        actions={
          <>
            <Link href={projectHref(projectId, 'plans', `horizon=${item.horizon}&date=${item.dueDate}`)}>Back to plan</Link>
            <ConfirmDialog
              action={remove}
              triggerLabel="Delete"
              title="Delete this plan item?"
              message="Entries linked to it are kept, without the link."
              confirmLabel="Delete item"
              fields={{ itemId: item.id }}
            />
          </>
        }
      />
      <Section title="Status">
        <div className={styles.meta}>
          <span>{item.dueLabel}</span>
          <PersonList people={item.assignees} />
        </div>
        <StatusForm item={item} action={setStatus} />
      </Section>
      <Section title="Move to another date" id="move">
        {item.status === 'done' ? (
          <p className="muted">Done items stay where they are. Change the status first to move it.</p>
        ) : (
          <ActionForm action={move} submitLabel="Move item" label="Move plan item" layout="inline">
            <TextField name="dueDate" label="New due date" type="date" defaultValue={item.dueDate} required />
          </ActionForm>
        )}
        <h3 className={styles.dayHeading}>History</h3>
        {item.moves.length === 0 ? (
          <p className="muted">Never moved.</p>
        ) : (
          <ol className={styles.history}>
            {item.moves.map((moveVm) => (
              <li key={moveVm.whenLabel + moveVm.toLabel}>
                Moved from {moveVm.fromLabel} to {moveVm.toLabel} <span>({moveVm.whenLabel})</span>
              </li>
            ))}
          </ol>
        )}
      </Section>
      <Section title="Edit">
        <ActionForm action={update} submitLabel="Save changes" label="Edit plan item">
          <TextField name="title" label="Title" defaultValue={item.form.title} required maxLength={300} wide />
          <SelectField name="areaId" label="Area" options={pickers.areas} defaultValue={item.form.areaId} emptyLabel="General (no area)" />
          <SelectField name="issueId" label="Issue" options={pickers.issues} defaultValue={item.form.issueId} emptyLabel="None" />
          <CheckboxGroupField name="personIds" legend="Assignees" options={pickers.people} defaultValues={item.form.personIds} />
        </ActionForm>
      </Section>
    </div>
  );
}
