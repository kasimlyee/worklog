import { notFound } from 'next/navigation';
import { AppShell } from '#src/ui/components/app-shell.tsx';
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
  return screen.bare === true ? screen.element : <AppShell signOut={previewPlainAction}>{screen.element}</AppShell>;
}
