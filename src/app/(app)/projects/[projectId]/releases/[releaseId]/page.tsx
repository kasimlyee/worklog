import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { appDatabase } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { deleteReleaseAction, updateReleaseAction } from '#src/server/actions/releases.ts';
import { toReleaseDetailVM } from '#src/server/mappers/view-models.ts';
import { listNotes } from '#src/server/services/notes.ts';
import { getRelease } from '#src/server/services/releases.ts';
import { ReleaseScreen } from '#src/ui/components/release-screens.tsx';
import { loadPickers, requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'Release' };

export default async function ReleasePage({ params }: PageProps<'/projects/[projectId]/releases/[releaseId]'>): Promise<React.JSX.Element> {
  await requireSession();
  const { projectId, releaseId } = await params;
  const project = await requireProject(projectId);
  const release = await getRelease(appDatabase(), project.id, releaseId);
  if (release === null) {
    notFound();
  }
  const [notes, pickers] = await Promise.all([listNotes(appDatabase(), project.id, { releaseId: release.id }), loadPickers(project.id)]);
  return (
    <ReleaseScreen
      projectId={project.id}
      release={toReleaseDetailVM(release, notes)}
      pickers={pickers}
      update={updateReleaseAction.bind(null, project.id, release.id)}
      remove={deleteReleaseAction.bind(null, project.id)}
    />
  );
}
