import { AppLink as Link } from './app-link.tsx';
import type { IssueHistoryVM, TimelineEventVM } from '#src/ui/view-models/issues.ts';
import { projectItemHref } from '#src/ui/routes.ts';
import { ExternalLink } from './external-link.tsx';
import { PersonList } from './person-list.tsx';
import { Section } from './page-header.tsx';
import { StatusTag } from './status-tag.tsx';

const smallLabel = 'font-mono text-xs font-medium tracking-wide text-muted uppercase';

/* The dot on the timeline's line says what kind of step it is. */
const dots: Readonly<Record<TimelineEventVM['kind'], string>> = {
  assigned: 'before:border-line-strong before:bg-surface',
  planned: 'before:border-line-strong before:bg-surface',
  logged: 'before:border-accent before:bg-surface',
  resolved: 'before:border-success-fg before:bg-success-fg',
};

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
        <dl className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-x-6 gap-y-3 rounded-md bg-sunken p-4">
          {history.summary.map((item) => (
            <div key={item.label}>
              <dt className={smallLabel}>{item.label}</dt>
              <dd className="mt-1 font-semibold wrap-anywhere">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <ol className="list-none">
        {history.events.map((event) => (
          <li
            key={event.key}
            // The ::before is the line joining this step to the next one.
            className="relative grid pb-5 before:absolute before:top-7 before:bottom-0 before:left-[5px] before:border-l-2 before:border-line last:pb-0 last:before:hidden sm:grid-cols-[7.5rem_1fr] sm:gap-3 sm:before:top-2 sm:before:left-[calc(7.5rem+0.75rem+5px)]"
            data-kind={event.kind}
          >
            <time dateTime={event.date} className="pl-6 text-sm text-muted sm:pt-px sm:pl-0 sm:text-right">
              {event.dateLabel}
            </time>
            <div className={`relative grid gap-1 pl-6 before:absolute before:top-1.5 before:left-0 before:size-3 before:rounded-full before:border-2 ${dots[event.kind]}`}>
              {kindLabels[event.kind] === event.title ? null : <p className={smallLabel}>{kindLabels[event.kind]}</p>}
              <p className="flex flex-wrap items-center gap-2 font-semibold wrap-anywhere">
                <EventTitle event={event} projectId={projectId} />
                {event.tags.map((tag) => (
                  <StatusTag key={tag.label} status={tag} />
                ))}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
                {event.detail === null ? null : <span>{event.detail}</span>}
                {event.people.length === 0 ? null : <PersonList people={event.people} />}
                {event.pullRequest === null ? null : (
                  <span className="inline-flex items-center gap-2">
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
