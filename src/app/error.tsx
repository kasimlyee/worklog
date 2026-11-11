'use client';

/* Client Component — required by Next.js for error boundaries. Shows a generic message only. */

export default function ErrorPage({ error, reset }: { readonly error: Error & { readonly digest?: string }; readonly reset: () => void }): React.JSX.Element {
  return (
    <main id="main" className="standalone">
      <h1>Something went wrong</h1>
      <p>The request could not be completed. Nothing you saved before this was lost.</p>
      {error.digest === undefined ? null : <p className="muted">Reference: {error.digest}</p>}
      <p>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </p>
    </main>
  );
}
