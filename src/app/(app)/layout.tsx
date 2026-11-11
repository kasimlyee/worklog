import { requireSession } from '#src/server/auth/next-session.ts';
import { signOutAction } from '#src/server/actions/auth.ts';
import { AppShell } from '#src/ui/components/app-shell.tsx';

export default async function SignedInLayout({ children }: LayoutProps<'/'>): Promise<React.JSX.Element> {
  await requireSession();
  return <AppShell signOut={signOutAction}>{children}</AppShell>;
}
