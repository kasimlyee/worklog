import Link from 'next/link';
import { Suspense } from 'react';
import { NavigationProgress } from './navigation-progress.tsx';
import type { PlainAction } from '#src/ui/view-models/forms.ts';
import { peopleHref, projectsHref } from '#src/ui/routes.ts';
import styles from './app-shell.module.css';

/** Header, skip link and main landmark for every signed-in page. */
export function AppShell({ signOut, children }: { readonly signOut: PlainAction; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.bar}>
          <Link href={projectsHref} className={styles.brand}>
            Worklog
          </Link>
          <nav aria-label="Main" className={styles.mainNav}>
            <Link href={projectsHref}>Projects</Link>
            <Link href={peopleHref}>People</Link>
          </nav>
          <form action={signOut}>
            <button type="submit" data-size="small" data-variant="ghost">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main id="main" className={styles.main} tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
