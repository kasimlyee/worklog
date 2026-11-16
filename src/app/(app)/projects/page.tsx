import type { Metadata } from 'next';
import { appDatabase, appToday } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { createProjectAction } from '#src/server/actions/projects.ts';
import { toOverviewVM } from '#src/server/mappers/view-models.ts';
import { getOverview } from '#src/server/services/overview.ts';
import { ProjectsScreen } from '#src/ui/components/projects-screen.tsx';

export const metadata: Metadata = { title: 'Overview' };

export default async function ProjectsPage(): Promise<React.JSX.Element> {
  await requireSession();
  const today = appToday();
  const overview = await getOverview(appDatabase(), today);
  return <ProjectsScreen overview={toOverviewVM(overview, today)} createProject={createProjectAction} />;
}
