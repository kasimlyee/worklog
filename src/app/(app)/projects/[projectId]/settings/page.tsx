import type { Metadata } from 'next';
import { appDatabase } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import {
  createAreaAction, renameAreaAction, reorderAreasAction, setAreaArchivedAction, setProjectArchivedAction, updateProjectAction,
} from '#src/server/actions/projects.ts';
import { toAreaVM } from '#src/server/mappers/view-models.ts';
import { listAreas } from '#src/server/services/projects.ts';
import { SettingsScreen } from '#src/ui/components/settings-screens.tsx';
import { requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage({ params }: PageProps<'/projects/[projectId]/settings'>): Promise<React.JSX.Element> {
  await requireSession();
  const project = await requireProject((await params).projectId);
  const areas = await listAreas(appDatabase(), project.id, { includeArchived: true });
  return (
    <SettingsScreen
      vm={{ project: { id: project.id, name: project.name, description: project.description, isArchived: project.isArchived }, areas: areas.map(toAreaVM) }}
      updateProject={updateProjectAction.bind(null, project.id)}
      createArea={createAreaAction.bind(null, project.id)}
      renameArea={renameAreaAction.bind(null, project.id)}
      setAreaArchived={setAreaArchivedAction.bind(null, project.id)}
      reorderAreas={reorderAreasAction.bind(null, project.id)}
      setProjectArchived={setProjectArchivedAction.bind(null, project.id)}
    />
  );
}
