import { AppLink as Link } from './app-link.tsx';
import type { PlainAction } from '#src/ui/view-models/forms.ts';
import type { PlanItemVM } from '#src/ui/view-models/plans.ts';
import { projectItemHref } from '#src/ui/routes.ts';
import { EmptyState } from './empty-state.tsx';
import { PersonList } from './person-list.tsx';
import { DeadlineLabel, StatusTag } from './status-tag.tsx';
import { AutoSubmitSelect, PendingSubmit } from './pending.tsx';
import { lists as styles } from './lists.ts';

const statusOptions = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
] as const;

/* The status at a glance, before the title; the tag beside the title says it in words. */
const glyphs: Readonly<Record<PlanItemVM['status'], { readonly colour: string; readonly path: string; readonly filled?: boolean }>> = {
  planned: { colour: 'text-line-strong', path: '' },
  in_progress: { colour: 'text-warning-fg', path: 'M12 6v6l4 2' },
  done: { colour: 'text-success-fg', path: 'M8 12.5l2.5 2.5L16 9.5', filled: true },
  blocked: { colour: 'text-danger-fg', path: 'M8 12h8' },
};

function StatusGlyph({ status }: { readonly status: PlanItemVM['status'] }): React.JSX.Element {
  const glyph = glyphs[status];
  return (
    <svg className={`flex-none ${glyph.colour}`} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill={glyph.filled === true ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" />
      {glyph.path === '' ? null : (
        <path d={glyph.path} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={glyph.filled === true ? 'stroke-surface' : 'stroke-current'} />
      )}
    </svg>
  );
}

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
        <li key={item.id} className={styles.itemWithAction}>
          <div className={styles.itemBody}>
            <div className={styles.row}>
              <StatusGlyph status={item.status} />
              <Link className={styles.title} href={projectItemHref(projectId, 'plans/items', item.id)}>
                {item.title}
              </Link>
              <StatusTag status={item.statusTag} />
              {item.deadline === null ? null : <DeadlineLabel status={item.deadline} />}
            </div>
            <div className={`${styles.meta} pl-7`}>
              <span>{item.dueLabel}</span>
              {item.area === null ? null : <span>{item.area}</span>}
              <PersonList people={item.assignees} />
              {item.issue === null || item.issueId === null ? null : (
                <span>
                  Issue: <Link href={projectItemHref(projectId, 'issues', item.issueId)}>{item.issue}</Link>
                </span>
              )}
              {item.moves.length > 0 ? <span>Moved {String(item.moves.length)}×</span> : null}
            </div>
          </div>
          {setStatus === undefined ? null : <StatusForm item={item} action={setStatus} />}
        </li>
      ))}
    </ul>
  );
}
