import { Suspense } from 'react';
import { AppLink as Link } from './app-link.tsx';
import { NavigationProgress } from './navigation-progress.tsx';
import type { PlainAction } from '#src/ui/view-models/forms.ts';
import { peopleHref, projectsHref } from '#src/ui/routes.ts';

const navLink =
  'flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-semibold text-side-muted no-underline hover:bg-side-hover hover:text-side-fg';

function Icon({ path, always = false }: { readonly path: string; readonly always?: boolean }): React.JSX.Element {
  return (
    // On a phone the bar has room for words or icons, not both.
    <svg className={always ? 'flex-none' : 'hidden flex-none lg:block'} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The frame of every signed-in page: a dark sidebar down the left on wide screens (a bar
 * across the top on narrow ones) with the brand, the main navigation and sign-out, the
 * skip link, and the main landmark. A project's own navigation joins the sidebar from
 * `ProjectFrame`.
 */
export function AppShell({ signOut, children }: { readonly signOut: PlainAction; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="lg:pl-64">
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <a className="absolute -top-12 left-2 z-40 rounded-sm border-2 border-accent bg-surface px-3 py-2 focus:top-2" href="#main">
        Skip to content
      </a>
      <header className="flex items-center gap-2 bg-side px-3 py-2 text-side-fg lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:w-64 lg:flex-col lg:items-stretch lg:gap-0 lg:border-r lg:border-side-line lg:p-3">
        <Link href={projectsHref} className="inline-flex items-center gap-2.5 px-1 text-lg font-[750] tracking-tight text-side-fg no-underline lg:px-3 lg:pt-2 lg:pb-5">
          <svg className="text-ink" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
            <rect width="24" height="24" rx="7" fill="currentColor" />
            <path className="stroke-ink-fg" d="M6.5 8h11M6.5 12h7M6.5 16h9" fill="none" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Worklog
        </Link>
        <nav aria-label="Main" className="flex min-w-0 flex-1 gap-0.5 lg:flex-none lg:flex-col">
          <Link className={navLink} href={projectsHref}>
            <Icon path="M4 5h6l2 2h8v12H4z" />
            Projects
          </Link>
          <Link className={navLink} href={peopleHref}>
            <Icon path="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M21 20c0-2.5-1.5-4.6-3.5-5.5" />
            People
          </Link>
        </nav>
        <form action={signOut} className="lg:mt-auto lg:border-t lg:border-side-line lg:pt-3">
          <button
            type="submit"
            data-size="small"
            data-variant="ghost"
            className="text-side-muted hover:bg-side-hover hover:text-side-fg lg:min-h-9 lg:w-full lg:justify-start lg:gap-3 lg:px-3 lg:text-sm"
          >
            <Icon path="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h9" always />
            <span className="max-sm:sr-only">Sign out</span>
          </button>
        </form>
      </header>
      <main id="main" className="mx-auto max-w-page px-4 pt-6 pb-16 focus:outline-none sm:px-8 lg:pt-8" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
