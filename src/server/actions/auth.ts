'use server';

import { redirect } from 'next/navigation';
import { signOut } from '#src/server/auth/next-session.ts';

/** docs/02 §7: a POST that deletes the session row and the cookie. */
export async function signOutAction(): Promise<void> {
  await signOut();
  redirect('/sign-in');
}
