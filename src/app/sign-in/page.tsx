import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentSession } from '#src/server/auth/next-session.ts';
import { SignInScreen } from '#src/ui/components/sign-in-screen.tsx';
import { param } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>): Promise<React.JSX.Element> {
  if ((await currentSession()) !== null) {
    redirect('/projects');
  }
  const query = await searchParams;
  const notice = param(query, 'notice');
  // `next` is passed on as-is; /auth/github accepts only same-origin paths (docs/02 §11).
  return <SignInScreen notice={notice === '' ? undefined : notice} next={param(query, 'next')} />;
}
