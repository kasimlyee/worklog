import { AppLink as Link } from './app-link.tsx';
import type { EntryVM } from '#src/ui/view-models/entries.ts';
import { projectItemHref } from '#src/ui/routes.ts';
import { EmptyState } from './empty-state.tsx';
import { ExternalLink } from './external-link.tsx';
import { PersonList } from './person-list.tsx';
import { StatusTag } from './status-tag.tsx';
import { lists as styles } from './lists.ts';

/** "Issues: A, B" — each a link; nothing when empty. */
function LinkedList({
  label,
  items,
  href,
}: {
  readonly label: string;
  readonly items: readonly { readonly id: string; readonly title: string }[];
  readonly href: (id: string) => ReturnType<typeof projectItemHref>;
}): React.JSX.Element | null {
  if (items.length === 0) {
    return null;
  }
  return (
    <span>
      {label}:{' '}
      {items.map((item, index) => (
        <span key={item.id}>
          {index > 0 ? ', ' : null}
          <Link href={href(item.id)}>{item.title}</Link>
        </span>
      ))}
    </span>
  );
}

export function EntryList({
  entries,
  projectId,
  showDate = true,
  empty = 'No work logged yet.',
}: {
  readonly entries: readonly EntryVM[];
  readonly projectId: string;
  readonly showDate?: boolean;
  readonly empty?: string;
}): React.JSX.Element {
  if (entries.length === 0) {
    return <EmptyState>{empty}</EmptyState>;
  }
  return (
    <ul className={styles.list}>
      {entries.map((entry) => (
        // A timeline: a dot for each piece of work, joined by a line down the side.
        <li
          key={entry.id}
          className="relative grid gap-1 pb-5 pl-6 before:absolute before:top-2 before:left-0 before:size-2.5 before:rounded-full before:bg-accent before:ring-4 before:ring-accent-soft after:absolute after:top-6 after:bottom-1 after:left-1 after:w-px after:bg-line last:pb-0 last:after:hidden"
        >
          <p className={styles.text}>{entry.description}</p>
          <div className={styles.meta}>
            {showDate ? <span>{entry.dateLabel}</span> : null}
            {entry.isWeekend ? <StatusTag status={{ tone: 'neutral', label: 'Weekend' }} /> : null}
            <span>{entry.area ?? 'General'}</span>
            <PersonList people={entry.people} />
            {entry.pullRequest === null ? null : (
              <span className={styles.row}>
                <ExternalLink href={entry.pullRequest.url}>
                  #{entry.pullRequest.number} {entry.pullRequest.title}
                </ExternalLink>
                <StatusTag status={entry.pullRequest.state} />
              </span>
            )}
            <LinkedList label="Plan" items={entry.planItems} href={(id) => projectItemHref(projectId, 'plans/items', id)} />
            <LinkedList label={entry.issues.length > 1 ? 'Issues' : 'Issue'} items={entry.issues} href={(id) => projectItemHref(projectId, 'issues', id)} />
            <Link href={projectItemHref(projectId, 'log', entry.id, 'edit')} aria-label={`Edit entry: ${entry.description}`}>
              Edit
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
