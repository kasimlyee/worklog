import { appToday } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { createEntryAction } from '#src/server/actions/entries.ts';
import { toPickers } from '#src/server/mappers/view-models.ts';
import { ProjectFrame } from '#src/ui/components/project-frame.tsx';
import { ProjectHeader } from '#src/ui/components/project-header.tsx';
import { ProjectNav } from '#src/ui/components/project-nav.tsx';
import { QuickLog } from '#src/ui/components/entry-form.tsx';
import { loadChrome, requireProject } from '#src/app/_lib/loaders.ts';

/** Session and project check, project header and navigation, and the quick log on every page. */
export default async function ProjectLayout({ children, params }: LayoutProps<'/projects/[projectId]'>): Promise<React.JSX.Element> {
  const { projectId } = await params;
  // Started together: the session check gates the response (a failure redirects before any
  // of this is rendered), and the project and chrome queries save two round trips.
  const [, project, chrome] = await Promise.all([requireSession(), requireProject(projectId), loadChrome(projectId)]);
  const today = appToday();
  const { overdueCount } = chrome;
  const pickers = toPickers(chrome.options);
  return (
    <ProjectFrame
      side={
        <>
          <ProjectHeader project={{ id: project.id, name: project.name, isArchived: project.isArchived, overdueCount }} />
          <ProjectNav projectId={project.id} />
        </>
      }
    >
      <QuickLog action={createEntryAction.bind(null, project.id)} pickers={pickers} today={today} />
      {children}
    </ProjectFrame>
  );
}
