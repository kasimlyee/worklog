import Link from 'next/link';
import type { PlainAction } from '#src/ui/view-models/forms.ts';
import type { PlanItemVM } from '#src/ui/view-models/plans.ts';
import { projectItemHref } from '#src/ui/routes.ts';
import { EmptyState } from './empty-state.tsx';
import { PersonList } from './person-list.tsx';
import { DeadlineLabel, StatusTag } from './status-tag.tsx';
import { AutoSubmitSelect, PendingSubmit } from './pending.tsx';
import styles from './lists.module.css';

const statusOptions = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
] as const;

/** BR-10, BR-16: change an item's status; a plain form, no JavaScript needed. */
export function StatusForm({ item, action }: { readonly item: PlanItemVM; readonly action: PlainAction }): React.JSX.Element {
  return (
    <form action={action} className={styles.row}>
      <input type="hidden" name="itemId" value={item.id} />
      <label className="visually-hidden" htmlFor={`status-${item.id}`}>
        Status of {item.title}
      </label>
      <AutoSubmitSelect id={`status-${item.id}`} name="status" defaultValue={item.status} className={styles.statusSelect} options={statusOptions} />
      <PendingSubmit label="Update" />
    </form>
  );
}

export function PlanItemList({
  items,
  projectId,
  setStatus,
  empty = 'Nothing planned.',
}: {
  readonly items: readonly PlanItemVM[];
  readonly projectId: string;
  readonly setStatus?: PlainAction;
  readonly empty?: string;
}): React.JSX.Element {
  if (items.length === 0) {
    return <EmptyState>{empty}</EmptyState>;
  }
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.id} className={styles.item}>
          <div className={styles.row}>
            <Link className={styles.title} href={projectItemHref(projectId, 'plans/items', item.id)}>
              {item.title}
            </Link>
            <StatusTag status={item.statusTag} />
            {item.deadline === null ? null : <DeadlineLabel status={item.deadline} />}
          </div>
          <div className={styles.meta}>
            <span>{item.dueLabel}</span>
            {item.area === null ? null : <span>{item.area}</span>}
            <PersonList people={item.assignees} />
            {item.issue === null ? null : <span>Issue: {item.issue}</span>}
            {item.moves.length > 0 ? <span>Moved {String(item.moves.length)}×</span> : null}
          </div>
          {setStatus === undefined ? null : <StatusForm item={item} action={setStatus} />}
        </li>
      ))}
    </ul>
  );
}
