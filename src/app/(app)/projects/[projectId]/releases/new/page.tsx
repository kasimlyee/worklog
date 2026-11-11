import type { Metadata } from 'next';
import { requireSession } from '#src/server/auth/next-session.ts';
import { createReleaseAction } from '#src/server/actions/releases.ts';
import { NewReleaseScreen } from '#src/ui/components/release-screens.tsx';
import { loadPickers, requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'New release' };

export default async function NewReleasePage({ params }: PageProps<'/projects/[projectId]/releases/new'>): Promise<React.JSX.Element> {
  await requireSession();
  const project = await requireProject((await params).projectId);
  const pickers = await loadPickers(project.id);
  return <NewReleaseScreen projectId={project.id} pickers={pickers} create={createReleaseAction.bind(null, project.id)} />;
}
