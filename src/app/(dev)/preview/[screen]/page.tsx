import { notFound } from 'next/navigation';
import * as f from '#src/ui/fixtures/fixtures.ts';
import { AppShell } from '#src/ui/components/app-shell.tsx';
import { ProjectFrame } from '#src/ui/components/project-frame.tsx';
import { ProjectHeader } from '#src/ui/components/project-header.tsx';
import { ProjectNav } from '#src/ui/components/project-nav.tsx';
import { isPreviewEnabled } from '#src/app/(dev)/preview/enabled.ts';
import { previewPlainAction } from '#src/app/(dev)/preview/actions.ts';
import { screens } from '#src/app/(dev)/preview/screens.tsx';

export default async function PreviewScreen({ params }: PageProps<'/preview/[screen]'>): Promise<React.JSX.Element> {
  if (!isPreviewEnabled(process.env.NODE_ENV)) {
    notFound();
  }
  const screen = screens[(await params).screen];
  if (screen === undefined) {
    notFound();
  }
  if (screen.bare === true) {
    return screen.element;
  }
  return (
    <AppShell signOut={previewPlainAction}>
      {screen.global === true ? (
        screen.element
      ) : (
        // The same frame as the real project layout, so previews show the navigation too.
        <ProjectFrame
          side={
            <>
              <ProjectHeader project={f.projectHeader} />
              <ProjectNav projectId={f.projectId} />
            </>
          }
        >
          {screen.element}
        </ProjectFrame>
      )}
    </AppShell>
  );
}
