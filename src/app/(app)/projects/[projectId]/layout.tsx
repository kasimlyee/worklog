import { appDatabase, appToday } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { createEntryAction } from '#src/server/actions/entries.ts';
import { listProjectSummaries } from '#src/server/services/dashboard.ts';
import { ProjectHeader } from '#src/ui/components/project-header.tsx';
import { ProjectNav } from '#src/ui/components/project-nav.tsx';
import { QuickLog } from '#src/ui/components/entry-form.tsx';
import { loadPickers, requireProject } from '#src/app/_lib/loaders.ts';

/** Session and project check, project header and navigation, and the quick log on every page. */
export default async function ProjectLayout({ children, params }: LayoutProps<'/projects/[projectId]'>): Promise<React.JSX.Element> {
  await requireSession();
  const project = await requireProject((await params).projectId);
  const today = appToday();
  const [summaries, pickers] = await Promise.all([listProjectSummaries(appDatabase(), today), loadPickers(project.id)]);
  const overdueCount = summaries.find((summary) => summary.id === project.id)?.overdueCount ?? 0;
  return (
    <>
      <ProjectHeader project={{ id: project.id, name: project.name, isArchived: project.isArchived, overdueCount }} />
      <ProjectNav projectId={project.id} />
      <QuickLog action={createEntryAction.bind(null, project.id)} pickers={pickers} today={today} />
      {children}
    </>
  );
}
