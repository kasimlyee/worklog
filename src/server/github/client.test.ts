import { describe, expect, it, vi } from 'vitest';
import { createGitHubClient } from './client.ts';
import { badCredentials, closedPull, forbidden, mergedPull, notFound, openPull } from './fixtures/recorded.ts';

const ref = { owner: 'acme', repo: 'app', number: 1 } as const;

function clientReturning(response: Response | Error): { client: ReturnType<typeof createGitHubClient>; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)));
  return { client: createGitHubClient({ fetch: fetchMock, apiUrl: 'https://api.github.com', token: 'tok' }), fetchMock };
}

describe('GitHub client', () => {
  it('requests the PR with token, API version and a timeout', async () => {
    const { client, fetchMock } = clientReturning(Response.json(openPull));

    await client.fetchPullRequest(ref);

    expect(fetchMock).toHaveBeenCalledWith('https://api.github.com/repos/acme/app/pulls/1', {
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer tok', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: expect.any(AbortSignal),
      cache: 'no-store',
    });
  });

  it.each([
    ['open', openPull, { title: 'Add sign-in page', state: 'open' }],
    ['merged', mergedPull, { title: 'Fix rounding in invoice totals', state: 'merged' }],
    ['closed', closedPull, { title: 'Experiment: new cache', state: 'closed' }],
  ])('BR-23: maps a %s PR', async (_label, body, expected) => {
    const { client } = clientReturning(Response.json(body));

    expect(await client.fetchPullRequest(ref)).toEqual({ ok: true, value: expected });
  });

  it('truncates an over-long title to the stored limit', async () => {
    const { client } = clientReturning(Response.json({ ...openPull, title: 'x'.repeat(600) }));

    const result = await client.fetchPullRequest(ref);

    expect(result.ok && result.value.title).toHaveLength(500);
  });

  it.each([
    ['404', Response.json(notFound, { status: 404 }), 'not_found_or_no_access'],
    ['401', Response.json(badCredentials, { status: 401 }), 'unauthorized'],
    ['403', Response.json(forbidden, { status: 403 }), 'forbidden'],
    ['403 rate limit', Response.json({}, { status: 403, headers: { 'x-ratelimit-remaining': '0' } }), 'rate_limited'],
    ['429', Response.json({}, { status: 429 }), 'rate_limited'],
    ['500', new Response('oops', { status: 500 }), 'invalid_response'],
    ['malformed JSON', new Response('{not json', { status: 200 }), 'invalid_response'],
    ['unexpected shape', Response.json({ title: '', state: 'weird' }), 'invalid_response'],
    ['timeout', new DOMException('The operation timed out.', 'TimeoutError'), 'timeout'],
    ['network failure', new TypeError('fetch failed'), 'network'],
  ])('BR-26: maps %s to a typed error', async (_label, response, code) => {
    const { client } = clientReturning(response);

    expect(await client.fetchPullRequest(ref)).toEqual({ ok: false, error: code });
  });
});
