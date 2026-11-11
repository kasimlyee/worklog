import type { Metadata } from 'next';
import { appToday } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { createIssueAction } from '#src/server/actions/issues.ts';
import { NewIssueScreen } from '#src/ui/components/issue-screens.tsx';
import { loadPickers, requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'New issue' };

export default async function NewIssuePage({ params }: PageProps<'/projects/[projectId]/issues/new'>): Promise<React.JSX.Element> {
  await requireSession();
  const project = await requireProject((await params).projectId);
  const pickers = await loadPickers(project.id);
  return <NewIssueScreen projectId={project.id} pickers={pickers} create={createIssueAction.bind(null, project.id)} today={appToday()} />;
}
