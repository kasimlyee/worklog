// Trimmed recordings of GitHub REST responses for GET /repos/{owner}/{repo}/pulls/{number}.
// Shared by the client tests and the E2E fake server (tests/e2e/fake-github/server.ts).

const base = {
  url: 'https://api.github.com/repos/acme/app/pulls/1',
  html_url: 'https://github.com/acme/app/pull/1',
  number: 1,
  locked: false,
  user: { login: 'grace', id: 101 },
  body: 'Description lives on GitHub.',
  created_at: '2026-11-02T09:00:00Z',
  updated_at: '2026-11-03T09:00:00Z',
  draft: false,
} as const;

export const openPull = { ...base, title: 'Add sign-in page', state: 'open', closed_at: null, merged_at: null } as const;
export const mergedPull = {
  ...base,
  title: 'Fix rounding in invoice totals',
  state: 'closed',
  closed_at: '2026-11-04T10:00:00Z',
  merged_at: '2026-11-04T10:00:00Z',
} as const;
export const closedPull = {
  ...base,
  title: 'Experiment: new cache',
  state: 'closed',
  closed_at: '2026-11-04T10:00:00Z',
  merged_at: null,
} as const;
export const notFound = { message: 'Not Found', documentation_url: 'https://docs.github.com/rest', status: '404' } as const;
export const badCredentials = { message: 'Bad credentials', status: '401' } as const;
export const forbidden = { message: 'Resource not accessible by personal access token', status: '403' } as const;
