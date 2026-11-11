import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { appDatabase, appToday } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { deleteIssueAction, resolveIssueAction, setIssueStatusAction, updateIssueAction } from '#src/server/actions/issues.ts';
import { toIssueDetailVM, toIssueHistoryVM } from '#src/server/mappers/view-models.ts';
import { getIssueHistory } from '#src/server/services/issue-history.ts';
import { getIssue } from '#src/server/services/issues.ts';
import { IssueScreen } from '#src/ui/components/issue-screens.tsx';
import { loadPickers, requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'Issue' };

export default async function IssuePage({ params }: PageProps<'/projects/[projectId]/issues/[issueId]'>): Promise<React.JSX.Element> {
  await requireSession();
  const { projectId, issueId } = await params;
  const project = await requireProject(projectId);
  const today = appToday();
  const [issue, pickers, history] = await Promise.all([
    getIssue(appDatabase(), project.id, issueId, today),
    loadPickers(project.id),
    getIssueHistory(appDatabase(), project.id, issueId, today),
  ]);
  if (issue === null) {
    notFound();
  }
  return (
    <IssueScreen
      projectId={project.id}
      issue={toIssueDetailVM(issue)}
      history={toIssueHistoryVM(issue, history)}
      pickers={pickers}
      update={updateIssueAction.bind(null, project.id, issue.id)}
      resolve={resolveIssueAction.bind(null, project.id, issue.id)}
      setStatus={setIssueStatusAction.bind(null, project.id)}
      remove={deleteIssueAction.bind(null, project.id)}
      today={today}
    />
  );
}
