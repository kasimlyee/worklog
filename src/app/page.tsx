import { redirect } from 'next/navigation';
import { requireSession } from '#src/server/auth/next-session.ts';

export default async function HomePage(): Promise<never> {
  await requireSession();
  redirect('/projects');
}
