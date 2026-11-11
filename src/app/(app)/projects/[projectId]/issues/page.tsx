import type { Metadata } from 'next';
import { appDatabase, appToday } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { toIssueVM } from '#src/server/mappers/view-models.ts';
import { listIssues } from '#src/server/services/issues.ts';
import { IssuesScreen } from '#src/ui/components/issue-screens.tsx';
import { requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'Issues' };

export default async function IssuesPage({ params }: PageProps<'/projects/[projectId]/issues'>): Promise<React.JSX.Element> {
  await requireSession();
  const project = await requireProject((await params).projectId);
  const issues = (await listIssues(appDatabase(), project.id, appToday())).map(toIssueVM);
  return (
    <IssuesScreen
      projectId={project.id}
      open={issues.filter((issue) => issue.status !== 'resolved')}
      resolved={issues.filter((issue) => issue.status === 'resolved')}
    />
  );
}
