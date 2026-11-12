const messages: Readonly<Record<string, string>> = {
  expired: 'Your session has ended. Please sign in again.',
};

/** Product spec §6: one "Sign in with GitHub" button. */
export function SignInScreen({ notice, next = '' }: { readonly notice?: string | undefined; readonly next?: string }): React.JSX.Element {
  const message = notice === undefined ? undefined : messages[notice];
  return (
    <main id="main" className="grid min-h-screen place-items-center p-4">
      <div className="grid w-full max-w-104 justify-items-start gap-5 rounded-lg border border-line bg-surface p-8 shadow-md">
        <svg className="text-ink" viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" focusable="false">
          <rect width="24" height="24" rx="6" fill="currentColor" />
          <path className="stroke-ink-fg" d="M6.5 8h11M6.5 12h7M6.5 16h9" fill="none" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className="grid gap-1">
          <h1>Worklog</h1>
          <p className="text-muted">Plans, work logs and reports for your projects.</p>
        </div>
        {message === undefined ? null : (
          <p className="rounded-md bg-neutral-bg px-3 py-2 text-sm text-neutral-fg" role="status">
            {message}
          </p>
        )}
        {/* A plain link: the OAuth start is a GET that redirects to GitHub (docs/02 §7). */}
        <a className="button" data-variant="primary" href={next === '' ? '/auth/github' : `/auth/github?${new URLSearchParams({ next }).toString()}`}>
          Sign in with GitHub
        </a>
      </div>
    </main>
  );
}
