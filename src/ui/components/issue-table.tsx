import Link from 'next/link';
import type { IssueVM } from '#src/ui/view-models/issues.ts';
import { projectItemHref } from '#src/ui/routes.ts';
import { EmptyState } from './empty-state.tsx';
import { ExternalLink } from './external-link.tsx';
import { PersonList } from './person-list.tsx';
import { DeadlineLabel, StatusTag } from './status-tag.tsx';
import styles from './lists.module.css';

export function IssueTable({ issues, projectId, caption }: { readonly issues: readonly IssueVM[]; readonly projectId: string; readonly caption: string }): React.JSX.Element {
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
            <th scope="col">Assignees</th>
            <th scope="col">Assigned</th>
            <th scope="col">Deadline</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id}>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
