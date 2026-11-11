import Link from 'next/link';
import type { EntryVM } from '#src/ui/view-models/entries.ts';
import { projectItemHref } from '#src/ui/routes.ts';
import { EmptyState } from './empty-state.tsx';
import { ExternalLink } from './external-link.tsx';
import { PersonList } from './person-list.tsx';
import { StatusTag } from './status-tag.tsx';
import styles from './lists.module.css';

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
        <li key={entry.id} className={styles.item}>
          <p className={styles.title}>{entry.description}</p>
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
            {entry.planItem === null ? null : <span>Plan: {entry.planItem}</span>}
            {entry.issue === null ? null : <span>Issue: {entry.issue}</span>}
            <Link href={projectItemHref(projectId, 'log', entry.id, 'edit')} aria-label={`Edit entry: ${entry.description}`}>
              Edit
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
