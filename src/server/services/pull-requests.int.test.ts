import { describe, expect, it, vi } from 'vitest';
import { anyString } from '#tests/fixtures/matchers.ts';
import { err, ok } from '#src/lib/result.ts';
import type { GitHubClient, GitHubErrorCode } from '#src/server/github/client.ts';
import { testDb } from '#tests/setup/test-db.ts';
import { aProject, aPullRequest, aRelease, anEntry, anIssue } from '#tests/fixtures/builders.ts';
import {
  addPullRequest, deletePullRequest, gitHubMessage, listPullRequests, refreshPullRequest, resolvePullRequest,
  type PullRequestDeps,
} from './pull-requests.ts';

const now = new Date('2026-11-10T08:00:00Z');

function github(result: Awaited<ReturnType<GitHubClient['fetchPullRequest']>>): GitHubClient & { fetchPullRequest: ReturnType<typeof vi.fn> } {
  return { fetchPullRequest: vi.fn(() => Promise.resolve(result)) };
}

function deps(client: GitHubClient): PullRequestDeps {
  return { db: testDb(), github: client, allowedOrgs: ['acme'], now: () => now };
}

const url = 'https://github.com/acme/app/pull/42';

describe('pull requests', () => {
  it('BR-23: fetches title and state once and stores them', async () => {
    const project = await aProject(testDb());
    const client = github(ok({ title: 'Add login', state: 'merged' }));

    const result = await addPullRequest(deps(client), project.id, { url });

    expect(result).toEqual({
      ok: true,
      value: { id: anyString, owner: 'acme', repo: 'app', number: 42, title: 'Add login', state: 'merged', url },
    });
    expect(client.fetchPullRequest).toHaveBeenCalledWith({ owner: 'acme', repo: 'app', number: 42 });
    const row = await testDb().selectFrom('pullRequests').selectAll().executeTakeFirstOrThrow();
    expect(row.fetchedAt).toEqual(now);
  });

  it('BR-25: pasting the same URL again reuses the record without calling GitHub', async () => {
    const project = await aProject(testDb());
    const first = await addPullRequest(deps(github(ok({ title: 'A', state: 'open' }))), project.id, { url });
    const client = github(ok({ title: 'B', state: 'open' }));

    const second = await addPullRequest(deps(client), project.id, { url: 'https://github.com/ACME/App/pull/42' });

    expect(second.ok && first.ok && second.value.id === first.value.id).toBe(true);
    expect(client.fetchPullRequest).not.toHaveBeenCalled();
  });

  it('BR-25: the same PR is stored once per project, separately in each project', async () => {
    const a = await aProject(testDb());
    const b = await aProject(testDb());
    const client = github(ok({ title: 'A', state: 'open' }));

    await addPullRequest(deps(client), a.id, { url });
    await addPullRequest(deps(client), b.id, { url });

    expect(await testDb().selectFrom('pullRequests').select('projectId').execute()).toHaveLength(2);
  });

  it('BR-21: rejects a malformed URL with a clear message', async () => {
    const project = await aProject(testDb());

    expect(await addPullRequest(deps(github(ok({ title: 'A', state: 'open' }))), project.id, { url: 'acme/app#1' })).toEqual({
      ok: false,
      error: { code: 'invalid', fieldErrors: { url: 'Paste a pull request link like https://github.com/org/repo/pull/123' } },
    });
    expect((await addPullRequest(deps(github(ok({ title: 'A', state: 'open' }))), project.id, {})).ok).toBe(false);
  });

  it('BR-22: rejects an organisation outside the allow-list', async () => {
    const project = await aProject(testDb());

    const result = await resolvePullRequest(deps(github(ok({ title: 'A', state: 'open' }))), project.id, 'https://github.com/evil/app/pull/1', 'prUrl');

    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid', fieldErrors: { prUrl: 'Pull requests from “evil” are not allowed. Check the organisation.' } },
    });
  });

  it.each<GitHubErrorCode>(['not_found_or_no_access', 'unauthorized', 'forbidden', 'rate_limited', 'timeout', 'network', 'invalid_response'])(
    'BR-26: on %s, creates no record and says why',
    async (code) => {
      const project = await aProject(testDb());

      const result = await addPullRequest(deps(github(err(code))), project.id, { url });

      expect(result).toEqual({ ok: false, error: { code: 'invalid', fieldErrors: { url: gitHubMessage(code) } } });
      expect(await testDb().selectFrom('pullRequests').selectAll().execute()).toEqual([]);
    },
  );

  it('BR-24: refresh re-fetches title and state', async () => {
    const project = await aProject(testDb());
    const pr = await aPullRequest(testDb(), project.id, { title: 'Old', state: 'open' });
    const later = new Date('2026-11-11T08:00:00Z');

    const result = await refreshPullRequest({ ...deps(github(ok({ title: 'New', state: 'merged' }))), now: () => later }, project.id, pr.id);

    expect(result).toMatchObject({ ok: true, value: { title: 'New', state: 'merged' } });
    const row = await testDb().selectFrom('pullRequests').select('fetchedAt').executeTakeFirstOrThrow();
    expect(row.fetchedAt).toEqual(later);
  });

  it('BR-24: a failed refresh keeps the stored values and reports why', async () => {
    const project = await aProject(testDb());
    const pr = await aPullRequest(testDb(), project.id, { title: 'Old' });

    const result = await refreshPullRequest(deps(github(err('timeout'))), project.id, pr.id);

    expect(result).toEqual({ ok: false, error: { code: 'conflict', message: gitHubMessage('timeout') } });
    expect((await listPullRequests(testDb(), project.id))[0]?.title).toBe('Old');
  });

  it('refresh of an unknown or foreign PR is not found', async () => {
    const project = await aProject(testDb());
    const other = await aProject(testDb());
    const pr = await aPullRequest(testDb(), other.id);
    const client = github(ok({ title: 'x', state: 'open' }));

    expect(await refreshPullRequest(deps(client), project.id, pr.id)).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await refreshPullRequest(deps(client), project.id, 'bad')).toEqual({ ok: false, error: { code: 'not_found' } });
  });

  it('BR-36: deletes an unreferenced PR', async () => {
    const project = await aProject(testDb());
    const pr = await aPullRequest(testDb(), project.id);

    expect(await deletePullRequest(testDb(), project.id, pr.id)).toEqual({ ok: true, value: null });
    expect(await deletePullRequest(testDb(), project.id, pr.id)).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await deletePullRequest(testDb(), project.id, 'bad')).toEqual({ ok: false, error: { code: 'not_found' } });
  });

  it.each(['entry', 'issue', 'release'] as const)('BR-36: refuses to delete a PR referenced by an %s', async (kind) => {
    const project = await aProject(testDb());
    const pr = await aPullRequest(testDb(), project.id);
    if (kind === 'entry') {
      await anEntry(testDb(), project.id, { pullRequestId: pr.id });
    } else if (kind === 'issue') {
      await anIssue(testDb(), project.id, { resolvedByPrId: pr.id });
    } else {
      const release = await aRelease(testDb(), project.id);
      await testDb().insertInto('releasePullRequests').values({ projectId: project.id, releaseId: release.id, pullRequestId: pr.id }).execute();
    }

    const result = await deletePullRequest(testDb(), project.id, pr.id);

    expect(result.ok || result.error.code).toBe('conflict');
  });
});
