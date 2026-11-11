import type { Metadata } from 'next';
import { appDatabase, appToday } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { createProjectAction } from '#src/server/actions/projects.ts';
import { listProjectSummaries } from '#src/server/services/dashboard.ts';
import { ProjectsScreen } from '#src/ui/components/projects-screen.tsx';

export const metadata: Metadata = { title: 'Projects' };

export default async function ProjectsPage(): Promise<React.JSX.Element> {
  await requireSession();
  const projects = await listProjectSummaries(appDatabase(), appToday());
  return <ProjectsScreen projects={projects} createProject={createProjectAction} />;
}
