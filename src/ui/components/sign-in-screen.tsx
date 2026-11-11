import styles from './sign-in-screen.module.css';

const messages: Readonly<Record<string, string>> = {
  expired: 'Your session has ended. Please sign in again.',
};

/** Product spec §6: one "Sign in with GitHub" button. */
export function SignInScreen({ notice }: { readonly notice?: string | undefined }): React.JSX.Element {
  const message = notice === undefined ? undefined : messages[notice];
  return (
    <main id="main" className={styles.page}>
      <div className={styles.card}>
        <h1>Worklog</h1>
        <p className={styles.lead}>Plans, work logs and reports for your projects.</p>
        {message === undefined ? null : (
          <p className={styles.notice} role="status">
            {message}
          </p>
        )}
        {/* A plain link: the OAuth start is a GET that redirects to GitHub (docs/02 §7). */}
        <a className="button" data-variant="primary" href="/auth/github">
          Sign in with GitHub
        </a>
      </div>
    </main>
  );
}
