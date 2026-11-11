import type { Metadata } from 'next';
import { appDatabase, appToday } from '#src/server/app-context.ts';
import { planIssueTodayAction } from '#src/server/actions/plans.ts';
import { isWorkingDay } from '#src/server/domain/calendar.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { arrangeIssues, toIssueVM } from '#src/server/mappers/view-models.ts';
import { issuePriorities, listIssues } from '#src/server/services/issues.ts';
import type { IssuePriority } from '#src/server/db/types.ts';
import { IssuesScreen } from '#src/ui/components/issue-screens.tsx';
import { param, requireProject } from '#src/app/_lib/loaders.ts';

function isPriority(value: string): value is IssuePriority {
  return issuePriorities.some((priority) => priority === value);
}

export const metadata: Metadata = { title: 'Issues' };

export default async function IssuesPage({ params, searchParams }: PageProps<'/projects/[projectId]/issues'>): Promise<React.JSX.Element> {
  await requireSession();
  const project = await requireProject((await params).projectId);
  const query = await searchParams;
  const requested = param(query, 'priority');
  const priority = isPriority(requested) ? requested : null;
  const sortBy = param(query, 'sort') === 'priority' ? 'priority' : 'deadline';
  const issues = arrangeIssues(await listIssues(appDatabase(), project.id, appToday()), { priority, sortBy }).map(toIssueVM);
  return (
    <IssuesScreen
      projectId={project.id}
      open={issues.filter((issue) => issue.status !== 'resolved')}
      resolved={issues.filter((issue) => issue.status === 'resolved')}
      controls={{ priority: priority ?? '', sortBy }}
      {...(isWorkingDay(appToday()) ? { planToday: planIssueTodayAction.bind(null, project.id) } : {})}
    />
  );
}
