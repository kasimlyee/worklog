import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { appDatabase } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { deleteEntryAction, updateEntryAction } from '#src/server/actions/entries.ts';
import { toEntryFormValues } from '#src/server/mappers/view-models.ts';
import { getEntry } from '#src/server/services/entries.ts';
import { EntryEditScreen } from '#src/ui/components/log-screen.tsx';
import { loadPickers, requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'Edit entry' };

export default async function EntryEditPage({ params }: PageProps<'/projects/[projectId]/log/[entryId]/edit'>): Promise<React.JSX.Element> {
  await requireSession();
  const { projectId, entryId } = await params;
  const project = await requireProject(projectId);
  const [entry, pickers] = await Promise.all([getEntry(appDatabase(), project.id, entryId), loadPickers(project.id)]);
  if (entry === null) {
    notFound();
  }
  return (
    <EntryEditScreen
      projectId={project.id}
      entryId={entry.id}
      values={toEntryFormValues(entry)}
      pickers={pickers}
      update={updateEntryAction.bind(null, project.id, entry.id)}
      remove={deleteEntryAction.bind(null, project.id)}
    />
  );
}
