import Link from 'next/link';
import { Suspense } from 'react';
import { NavigationProgress } from './navigation-progress.tsx';
import type { PlainAction } from '#src/ui/view-models/forms.ts';
import { peopleHref, projectsHref } from '#src/ui/routes.ts';

const navLink = 'rounded-full px-3 py-1 font-semibold text-muted no-underline hover:bg-sunken hover:text-fg';

/** Header, skip link and main landmark for every signed-in page. */
export function AppShell({ signOut, children }: { readonly signOut: PlainAction; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <a
        className="absolute -top-12 left-2 z-10 rounded-sm border-2 border-accent bg-surface px-3 py-2 focus:top-2"
        href="#main"
      >
        Skip to content
      </a>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-page items-center gap-3 px-4 py-3 sm:gap-5 sm:px-6">
          <Link href={projectsHref} className="inline-flex items-center gap-2 text-lg font-[750] tracking-tight text-fg no-underline">
            <svg className="text-ink" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
              <rect width="24" height="24" rx="6" fill="currentColor" />
              <path className="stroke-ink-fg" d="M6.5 8h11M6.5 12h7M6.5 16h9" fill="none" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Worklog
          </Link>
          <nav aria-label="Main" className="flex flex-1 gap-1 text-sm">
            <Link className={navLink} href={projectsHref}>
              Projects
            </Link>
            <Link className={navLink} href={peopleHref}>
              People
            </Link>
          </nav>
          <form action={signOut}>
            <button type="submit" data-size="small" data-variant="ghost">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-page px-4 pt-6 pb-12 focus:outline-none sm:px-6" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
