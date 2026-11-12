import Link from 'next/link';
import type { PlainAction } from '#src/ui/view-models/forms.ts';
import type { IssueVM } from '#src/ui/view-models/issues.ts';
import { ActionButton } from './action-button.tsx';
import { DraggableIssueRow } from './plan-today.tsx';
import { projectItemHref } from '#src/ui/routes.ts';
import { EmptyState } from './empty-state.tsx';
import { ExternalLink } from './external-link.tsx';
import { PersonList } from './person-list.tsx';
import { DeadlineLabel, StatusTag } from './status-tag.tsx';
import { lists as styles } from './lists.ts';

type IssueTableProps = {
  readonly issues: readonly IssueVM[];
  readonly projectId: string;
  readonly caption: string;
  /** BR-38: a "Plan today" button on each unresolved issue (absent at the weekend). */
  readonly planToday?: PlainAction;
  /** BR-38: rows can be dragged onto Today's plan (dashboard). */
  readonly draggable?: boolean;
};

export function IssueTable({ issues, projectId, caption, planToday, draggable = false }: IssueTableProps): React.JSX.Element {
  if (issues.length === 0) {
    return <EmptyState>No issues.</EmptyState>;
  }
  return (
    <div className={styles.tableWrap}>
      <table>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Issue</th>
            <th scope="col">Priority</th>
            <th scope="col">Assignees</th>
            <th scope="col">Assigned</th>
            <th scope="col">Deadline</th>
            <th scope="col">Status</th>
            {planToday === undefined ? null : (
              <th scope="col">
                <span className="visually-hidden">Today</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => {
            const cells = (
              <>
                <td>
                  <Link href={projectItemHref(projectId, 'issues', issue.id)}>{issue.title}</Link>
                  {issue.externalUrl === null ? null : (
                    <>
                      {' '}
                      <ExternalLink href={issue.externalUrl}>Open link</ExternalLink>
                    </>
                  )}
                  {issue.area === null ? null : <div className="muted">{issue.area}</div>}
                </td>
                <td>
                  <StatusTag status={issue.priorityTag} />
                </td>
                <td>
                  <PersonList people={issue.assignees} />
                </td>
                <td>{issue.assignedLabel}</td>
                <td>
                  <div>{issue.deadlineLabel}</div>
                  <DeadlineLabel status={issue.deadline} />
                </td>
                <td>
                  <StatusTag status={issue.statusTag} />
                </td>
                {planToday === undefined ? null : (
                  <td>
                    {issue.status === 'resolved' ? null : (
                      <ActionButton action={planToday} label="Plan today" fields={{ issueId: issue.id }} accessibleLabel={`Plan today: ${issue.title}`} />
                    )}
                  </td>
                )}
              </>
            );
            return draggable && issue.status !== 'resolved' ? (
              <DraggableIssueRow key={issue.id} issueId={issue.id} title={issue.title}>
                {cells}
              </DraggableIssueRow>
            ) : (
              <tr key={issue.id}>{cells}</tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
