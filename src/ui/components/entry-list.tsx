import { AppLink as Link } from './app-link.tsx';
import type { EntryVM } from '#src/ui/view-models/entries.ts';
import { projectItemHref } from '#src/ui/routes.ts';
import { EmptyState } from './empty-state.tsx';
import { ExternalLink } from './external-link.tsx';
import { ClosureNotes } from './issue-history.tsx';
import { PersonList } from './person-list.tsx';
import { StatusTag } from './status-tag.tsx';
import { lists as styles } from './lists.ts';

const fixedTag = { tone: 'success', label: 'Fixed' } as const;
const finishedTag = { tone: 'success', label: 'Finished' } as const;

/** BR-44/BR-45: what the entry worked on, and what it closed, with the issue's short notes. */
function Links({ entry, projectId }: { readonly entry: EntryVM; readonly projectId: string }): React.JSX.Element | null {
  if (entry.issues.length === 0 && entry.planItems.length === 0) {
    return null;
  }
  return (
    <ul className="grid list-none gap-2 text-sm">
      {entry.issues.map((issue) => {
        const notes = [
          ...(issue.summary === '' ? [] : [{ label: 'Issue' as const, text: issue.summary }]),
          ...(issue.cause === '' ? [] : [{ label: 'Cause' as const, text: issue.cause }]),
          ...(issue.fix === '' ? [] : [{ label: 'Fix' as const, text: issue.fix }]),
        ];
        return (
          <li key={`issue-${issue.id}`} className="grid gap-1">
            <span className={styles.row}>
              <span className="text-muted">Issue</span>
              <Link href={projectItemHref(projectId, 'issues', issue.id)}>{issue.title}</Link>
              {issue.resolves ? <StatusTag status={fixedTag} /> : null}
            </span>
            {notes.length === 0 ? null : <ClosureNotes notes={notes} />}
          </li>
        );
      })}
      {entry.planItems.map((item) => (
        <li key={`plan-${item.id}`} className={styles.row}>
          <span className="text-muted">Plan</span>
          <Link href={projectItemHref(projectId, 'plans/items', item.id)}>{item.title}</Link>
          {item.completes ? <StatusTag status={finishedTag} /> : null}
        </li>
      ))}
    </ul>
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
            {entry.pullRequests.map((pr) => (
              <span key={pr.id} className={styles.row}>
                <ExternalLink href={pr.url}>
                  #{pr.number} {pr.title}
                </ExternalLink>
                <StatusTag status={pr.state} />
              </span>
            ))}
            <Link href={projectItemHref(projectId, 'log', entry.id, 'edit')} aria-label={`Edit entry: ${entry.description}`}>
              Edit
            </Link>
          </div>
          <Links entry={entry} projectId={projectId} />
        </li>
      ))}
    </ul>
  );
}
