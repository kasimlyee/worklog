import type { Metadata } from 'next';
import { requireSession } from '#src/server/auth/next-session.ts';
import { createNoteAction } from '#src/server/actions/notes.ts';
import { NoteEditScreen } from '#src/ui/components/note-screens.tsx';
import { loadPickers, param, requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'New note' };

export default async function NewNotePage({ params, searchParams }: PageProps<'/projects/[projectId]/notes/new'>): Promise<React.JSX.Element> {
  await requireSession();
  const project = await requireProject((await params).projectId);
  const query = await searchParams;
  const pickers = await loadPickers(project.id);
  // ?releaseId=… or ?pullRequestId=… preselects what the note is attached to (BR-35).
  const values = { title: '', body: '', releaseId: param(query, 'releaseId'), pullRequestId: param(query, 'pullRequestId'), links: [] };
  return <NoteEditScreen projectId={project.id} title="New note" values={values} pickers={pickers} save={createNoteAction.bind(null, project.id)} />;
}
