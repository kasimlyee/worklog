import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { appDatabase, appTimeZone } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { deleteNoteAction } from '#src/server/actions/notes.ts';
import { toNoteVM } from '#src/server/mappers/view-models.ts';
import { getNote } from '#src/server/services/notes.ts';
import { NoteScreen } from '#src/ui/components/note-screens.tsx';
import { requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'Note' };

export default async function NotePage({ params }: PageProps<'/projects/[projectId]/notes/[noteId]'>): Promise<React.JSX.Element> {
  await requireSession();
  const { projectId, noteId } = await params;
  const project = await requireProject(projectId);
  const note = await getNote(appDatabase(), project.id, noteId);
  if (note === null) {
    notFound();
  }
  return <NoteScreen projectId={project.id} note={toNoteVM(note, appTimeZone())} remove={deleteNoteAction.bind(null, project.id)} />;
}
