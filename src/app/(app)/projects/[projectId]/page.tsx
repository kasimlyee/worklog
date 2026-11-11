import type { Metadata } from 'next';
import { appDatabase, appTimeZone, appToday } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { setPlanItemStatusAction } from '#src/server/actions/plans.ts';
import { toDashboardVM } from '#src/server/mappers/view-models.ts';
import { getDashboard } from '#src/server/services/dashboard.ts';
import { DashboardScreen } from '#src/ui/components/dashboard-screen.tsx';
import { requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage({ params }: PageProps<'/projects/[projectId]'>): Promise<React.JSX.Element> {
  await requireSession();
  const project = await requireProject((await params).projectId);
  const today = appToday();
  const dashboard = await getDashboard(appDatabase(), project.id, today);
  return <DashboardScreen projectId={project.id} vm={toDashboardVM(dashboard, today, appTimeZone())} setStatus={setPlanItemStatusAction.bind(null, project.id)} />;
}
