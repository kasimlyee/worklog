import { err, ok, type Result } from '#src/lib/result.ts';

export type PrRef = { readonly owner: string; readonly repo: string; readonly number: number };
export type PrUrlError = { readonly code: 'invalid_format' } | { readonly code: 'org_not_allowed'; readonly owner: string };

// BR-21: the one accepted form. Anchored, exact host, no userinfo, query or fragment.
const prUrlPattern =
  /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})\/pull\/([1-9]\d{0,9})$/;
const maxPrNumber = 2_147_483_647; // Postgres integer

/** BR-21, BR-22: parse a pasted PR URL and check its owner against the allow-list (lower-case). */
export function parsePullRequestUrl(input: string, allowedOrgs: readonly string[]): Result<PrRef, PrUrlError> {
  const match = prUrlPattern.exec(input.trim());
  const [, owner, repo, numberText] = match ?? [];
  const number = Number(numberText);
  if (owner === undefined || repo === undefined || number > maxPrNumber || repo === '.' || repo === '..') {
    return err({ code: 'invalid_format' });
  }
  if (!allowedOrgs.includes(owner.toLowerCase())) {
    return err({ code: 'org_not_allowed', owner });
  }
  return ok({ owner, repo, number });
}

/** The URL is derived, never stored (docs/02 §5.3). */
export function pullRequestUrl(ref: PrRef): string {
  return `https://github.com/${ref.owner}/${ref.repo}/pull/${String(ref.number)}`;
}
