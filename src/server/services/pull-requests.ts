import 'server-only';
import * as z from 'zod';
import { assertNever } from '#src/lib/assert-never.ts';
import { ok } from '#src/lib/result.ts';
import type { Db } from '#src/server/db/client.ts';
import { isForeignKeyViolation } from '#src/server/db/errors.ts';
import type { PrState } from '#src/server/db/types.ts';
import { parsePullRequestUrl, pullRequestUrl, type PrUrlError } from '#src/server/domain/pull-request-url.ts';
import type { GitHubClient, GitHubErrorCode } from '#src/server/github/client.ts';
import {
  deletePullRequestRow, insertPullRequest, selectPullRequest, selectPullRequestByRef, selectPullRequests,
  updatePullRequestRow, type PullRequestRow,
} from '#src/server/repositories/pull-requests.ts';
import { conflict, invalid, notFound, parseInput, type ServiceResult } from './errors.ts';
import { isUuid } from './fields.ts';

export type PullRequest = {
  readonly id: string;
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
  readonly title: string;
  readonly state: PrState;
  readonly url: string;
};

export type PullRequestDeps = {
  readonly db: Db;
  readonly github: GitHubClient;
  readonly allowedOrgs: readonly string[];
  readonly now: () => Date;
};

export function toPullRequest(row: Pick<PullRequestRow, 'id' | 'owner' | 'repo' | 'number' | 'title' | 'state'>): PullRequest {
  return {
    id: row.id,
    owner: row.owner,
    repo: row.repo,
    number: row.number,
    title: row.title,
    state: row.state,
    url: pullRequestUrl(row),
  };
}

function urlMessage(error: PrUrlError): string {
  switch (error.code) {
    case 'invalid_format':
      return 'Paste a pull request link like https://github.com/org/repo/pull/123';
    case 'org_not_allowed':
      return `Pull requests from “${error.owner}” are not allowed. Check the organisation.`;
    default:
      return assertNever(error);
  }
}

/** BR-26: the user sees why GitHub failed. */
export function gitHubMessage(code: GitHubErrorCode): string {
  switch (code) {
    case 'not_found_or_no_access':
      return 'GitHub could not find this pull request, or the token cannot see that repository.';
    case 'unauthorized':
      return 'The GitHub token was rejected. It may have expired.';
    case 'forbidden':
      return 'The GitHub token is not allowed to read this repository.';
    case 'rate_limited':
      return 'GitHub rate limit reached. Try again in a few minutes.';
    case 'timeout':
      return 'GitHub did not answer in time. Try again.';
    case 'network':
      return 'Could not reach GitHub. Check the connection and try again.';
    case 'invalid_response':
      return 'GitHub sent an unexpected response. Try again later.';
    default:
      return assertNever(code);
  }
}

/**
 * BR-21…BR-26: find or add the PR behind `url` in this project. An existing record is
 * reused without calling GitHub; a new one is created only after a successful fetch.
 * Errors are reported on `field`, so forms can show them next to their own input.
 */
export async function resolvePullRequest(
  deps: PullRequestDeps,
  projectId: string,
  url: string,
  field = 'url',
): Promise<ServiceResult<PullRequest>> {
  const parsed = parsePullRequestUrl(url, deps.allowedOrgs);
  if (!parsed.ok) {
    return invalid({ [field]: urlMessage(parsed.error) });
  }
  const existing = await selectPullRequestByRef(deps.db, projectId, parsed.value);
  if (existing !== undefined) {
    return ok(toPullRequest(existing));
  }
  const fetched = await deps.github.fetchPullRequest(parsed.value);
  if (!fetched.ok) {
    return invalid({ [field]: gitHubMessage(fetched.error) });
  }
  const inserted = await insertPullRequest(deps.db, {
    projectId,
    ...parsed.value,
    ...fetched.value,
    fetchedAt: deps.now(),
  });
  // A concurrent add of the same PR won the race: use its row.
  const row = inserted ?? (await selectPullRequestByRef(deps.db, projectId, parsed.value));
  return row === undefined ? notFound : ok(toPullRequest(row));
}

const addInput = z.object({ url: z.string({ error: 'Paste a pull request link.' }).max(300, 'That link is too long.') });

export async function addPullRequest(deps: PullRequestDeps, projectId: string, input: unknown): Promise<ServiceResult<PullRequest>> {
  const parsed = parseInput(addInput, input);
  return parsed.ok ? await resolvePullRequest(deps, projectId, parsed.value.url) : parsed;
}

/** BR-24: re-fetch title and state on demand. */
export async function refreshPullRequest(
  deps: PullRequestDeps,
  projectId: string,
  pullRequestId: string,
): Promise<ServiceResult<PullRequest>> {
  if (!isUuid(pullRequestId)) {
    return notFound;
  }
  const existing = await selectPullRequest(deps.db, projectId, pullRequestId);
  if (existing === undefined) {
    return notFound;
  }
  const fetched = await deps.github.fetchPullRequest(existing);
  if (!fetched.ok) {
    return conflict(gitHubMessage(fetched.error));
  }
  const row = await updatePullRequestRow(deps.db, projectId, pullRequestId, { ...fetched.value, fetchedAt: deps.now() });
  return row === undefined ? notFound : ok(toPullRequest(row));
}

export async function listPullRequests(db: Db, projectId: string): Promise<readonly PullRequest[]> {
  return (await selectPullRequests(db, projectId)).map(toPullRequest);
}

/** BR-36: only when nothing references it. The database refuses otherwise. */
export async function deletePullRequest(db: Db, projectId: string, pullRequestId: string): Promise<ServiceResult<null>> {
  if (!isUuid(pullRequestId)) {
    return notFound;
  }
  try {
    return (await deletePullRequestRow(db, projectId, pullRequestId)) ? ok(null) : notFound;
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return conflict('This pull request is used by entries, issues, releases or notes, so it cannot be deleted.');
    }
    throw error;
  }
}
