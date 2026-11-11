import 'server-only';
import * as z from 'zod';
import { err, ok, type Result } from '#src/lib/result.ts';
import type { PrState } from '#src/server/db/types.ts';
import type { PrRef } from '#src/server/domain/pull-request-url.ts';

export type GitHubErrorCode =
  | 'not_found_or_no_access'
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'timeout'
  | 'network'
  | 'invalid_response';

export type PullRequestData = { readonly title: string; readonly state: PrState };

export type GitHubClient = {
  readonly fetchPullRequest: (ref: PrRef) => Promise<Result<PullRequestData, GitHubErrorCode>>;
};

type ClientOptions = {
  readonly fetch: typeof fetch;
  readonly apiUrl: string;
  readonly token: string;
  readonly timeoutMs?: number;
};

const apiVersion = '2022-11-28';

const pullResponse = z.object({
  title: z.string().trim().min(1).transform((title) => title.slice(0, 500)),
  state: z.enum(['open', 'closed']),
  merged_at: z.string().nullable(),
});

function statusError(response: Response): GitHubErrorCode {
  switch (response.status) {
    case 401:
      return 'unauthorized';
    case 404:
      return 'not_found_or_no_access';
    case 429:
      return 'rate_limited';
    case 403:
      return response.headers.get('x-ratelimit-remaining') === '0' ? 'rate_limited' : 'forbidden';
    default:
      return 'invalid_response';
  }
}

/** docs/02 §8: one GET per PR, validated; `fetch` is injected so tests never call GitHub. */
export function createGitHubClient({ fetch: fetchImpl, apiUrl, token, timeoutMs = 5000 }: ClientOptions): GitHubClient {
  return {
    fetchPullRequest: async ({ owner, repo, number }) => {
      let response: Response;
      try {
        response = await fetchImpl(
          `${apiUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${String(number)}`,
          {
            headers: {
              Accept: 'application/vnd.github+json',
              Authorization: `Bearer ${token}`,
              'X-GitHub-Api-Version': apiVersion,
            },
            signal: AbortSignal.timeout(timeoutMs),
            cache: 'no-store',
          },
        );
      } catch (error) {
        return err(error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'network');
      }
      if (!response.ok) {
        return err(statusError(response));
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return err('invalid_response');
      }
      const parsed = pullResponse.safeParse(body);
      if (!parsed.success) {
        return err('invalid_response');
      }
      const { title, state, merged_at: mergedAt } = parsed.data;
      return ok({ title, state: mergedAt === null ? state : 'merged' });
    },
  };
}
