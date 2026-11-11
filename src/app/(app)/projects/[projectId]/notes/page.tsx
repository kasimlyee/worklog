import type { Metadata } from 'next';
import { appDatabase, appTimeZone } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { toNoteVM } from '#src/server/mappers/view-models.ts';
import { listNotes } from '#src/server/services/notes.ts';
import { NotesScreen } from '#src/ui/components/note-screens.tsx';
import { requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'Notes' };

export default async function NotesPage({ params }: PageProps<'/projects/[projectId]/notes'>): Promise<React.JSX.Element> {
  await requireSession();
  const project = await requireProject((await params).projectId);
  const notes = await listNotes(appDatabase(), project.id);
  return <NotesScreen projectId={project.id} notes={notes.map((note) => toNoteVM(note, appTimeZone()))} />;
}
