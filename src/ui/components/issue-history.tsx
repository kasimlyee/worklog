import Link from 'next/link';
import type { IssueHistoryVM, TimelineEventVM } from '#src/ui/view-models/issues.ts';
import { projectItemHref } from '#src/ui/routes.ts';
import { ExternalLink } from './external-link.tsx';
import { PersonList } from './person-list.tsx';
import { Section } from './page-header.tsx';
import { StatusTag } from './status-tag.tsx';
import styles from './issue-history.module.css';

const kindLabels: Readonly<Record<TimelineEventVM['kind'], string>> = {
  assigned: 'Assigned',
  planned: 'Plan item',
  logged: 'Work logged',
  resolved: 'Resolved',
};

function EventTitle({ event, projectId }: { readonly event: TimelineEventVM; readonly projectId: string }): React.JSX.Element {
  if (event.planItemId !== null) {
    return <Link href={projectItemHref(projectId, 'plans/items', event.planItemId)}>{event.title}</Link>;
  }
  if (event.entryId !== null) {
    return <Link href={projectItemHref(projectId, 'log', event.entryId, 'edit')}>{event.title}</Link>;
  }
  return <>{event.title}</>;
}

/** BR-40: how an issue was worked on and resolved, from assignment to resolution. */
export function IssueHistory({ projectId, history }: { readonly projectId: string; readonly history: IssueHistoryVM }): React.JSX.Element {
  return (
    <Section title={history.isResolved ? 'How it was resolved' : 'History'} id="history">
      {history.summary.length === 0 ? null : (
        <dl className={styles.summary}>
          {history.summary.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <ol className={styles.timeline}>
        {history.events.map((event) => (
          <li key={event.key} className={styles.event} data-kind={event.kind}>
            <time dateTime={event.date} className={styles.date}>
              {event.dateLabel}
            </time>
            <div className={styles.body}>
              {kindLabels[event.kind] === event.title ? null : <p className={styles.kind}>{kindLabels[event.kind]}</p>}
              <p className={styles.title}>
                <EventTitle event={event} projectId={projectId} />
                {event.tags.map((tag) => (
                  <StatusTag key={tag.label} status={tag} />
                ))}
              </p>
              <div className={styles.meta}>
                {event.detail === null ? null : <span>{event.detail}</span>}
                {event.people.length === 0 ? null : <PersonList people={event.people} />}
                {event.pullRequest === null ? null : (
                  <span className={styles.pr}>
                    <ExternalLink href={event.pullRequest.url}>
                      #{event.pullRequest.number} {event.pullRequest.title}
                    </ExternalLink>
                    <StatusTag status={event.pullRequest.state} />
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {history.events.length === 1 ? <p className="muted">No plan items or log entries are linked to this issue yet.</p> : null}
    </Section>
  );
}
