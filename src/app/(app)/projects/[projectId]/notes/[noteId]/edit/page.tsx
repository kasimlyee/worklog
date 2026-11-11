import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { appDatabase } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { updateNoteAction } from '#src/server/actions/notes.ts';
import { toNoteFormValues } from '#src/server/mappers/view-models.ts';
import { getNote } from '#src/server/services/notes.ts';
import { NoteEditScreen } from '#src/ui/components/note-screens.tsx';
import { projectItemHref } from '#src/ui/routes.ts';
import { loadPickers, requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'Edit note' };

export default async function EditNotePage({ params }: PageProps<'/projects/[projectId]/notes/[noteId]/edit'>): Promise<React.JSX.Element> {
  await requireSession();
  const { projectId, noteId } = await params;
  const project = await requireProject(projectId);
  const [note, pickers] = await Promise.all([getNote(appDatabase(), project.id, noteId), loadPickers(project.id)]);
  if (note === null) {
    notFound();
  }
  return (
    <NoteEditScreen
      projectId={project.id}
      title="Edit note"
      values={toNoteFormValues(note)}
      pickers={pickers}
      save={updateNoteAction.bind(null, project.id, note.id)}
      backHref={projectItemHref(project.id, 'notes', note.id)}
    />
  );
}
