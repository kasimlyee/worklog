import { vi } from 'vitest';
import { ok } from '#src/lib/result.ts';
import type { GitHubClient, PullRequestData } from '#src/server/github/client.ts';
import type { PullRequestDeps } from '#src/server/services/pull-requests.ts';
import type { Db } from '#src/server/db/client.ts';

/** A GitHub client that answers every PR with the given data (default: an open PR titled by number). */
export function fakeGitHub(data?: PullRequestData): GitHubClient & { readonly fetchPullRequest: ReturnType<typeof vi.fn> } {
  return {
    fetchPullRequest: vi.fn((ref: { readonly number: number }) =>
      Promise.resolve(ok(data ?? { title: `PR ${String(ref.number)}`, state: 'open' as const })),
    ),
  };
}

export function prDeps(db: Db, github: GitHubClient = fakeGitHub()): PullRequestDeps {
  return { db, github, allowedOrgs: ['acme'], now: () => new Date('2026-11-10T08:00:00Z') };
}
