import type { Metadata } from 'next';
import { appDatabase } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { toReleaseVM } from '#src/server/mappers/view-models.ts';
import { listReleases } from '#src/server/services/releases.ts';
import { ReleasesScreen } from '#src/ui/components/release-screens.tsx';
import { requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'Releases' };

export default async function ReleasesPage({ params }: PageProps<'/projects/[projectId]/releases'>): Promise<React.JSX.Element> {
  await requireSession();
  const project = await requireProject((await params).projectId);
  const releases = await listReleases(appDatabase(), project.id);
  return <ReleasesScreen projectId={project.id} releases={releases.map(toReleaseVM)} />;
}
