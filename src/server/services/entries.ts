import 'server-only';
import * as z from 'zod';
import { ok } from '#src/lib/result.ts';
import type { Db } from '#src/server/db/client.ts';
import { parseIsoDate, type IsoDate } from '#src/server/domain/calendar.ts';
import {
  deleteEntryRow, insertEntry, selectEntries, updateEntryRow, type EntryLinks, type EntryRow, type NamedRef,
} from '#src/server/repositories/entries.ts';
import { resolveIssueIfOpen } from '#src/server/repositories/issues.ts';
import { invalid, notFound, parseInput, type ServiceResult } from './errors.ts';
import { idList, isUuid, optionalId, requiredDate, requiredText } from './fields.ts';
import { resolvePullRequest, toPullRequest, type PullRequest, type PullRequestDeps } from './pull-requests.ts';
import { referenceErrors } from './references.ts';

export type Entry = {
  readonly id: string;
  readonly workDate: IsoDate;
  readonly description: string;
  readonly area: NamedRef | null;
  readonly people: readonly NamedRef[];
  readonly pullRequest: PullRequest | null;
  /** BR-17: any number of each — one PR often carries several fixes. */
  readonly planItems: readonly { readonly id: string; readonly title: string }[];
  readonly issues: readonly { readonly id: string; readonly title: string }[];
};

export function toEntry(row: EntryRow): Entry {
  const { prOwner, prRepo, prNumber, prTitle, prState } = row;
  return {
    id: row.id,
    workDate: row.workDate,
    description: row.description,
    area: row.areaId !== null && row.areaName !== null ? { id: row.areaId, name: row.areaName } : null,
    people: row.people,
    pullRequest:
      row.pullRequestId !== null && prOwner !== null && prRepo !== null && prNumber !== null && prTitle !== null && prState !== null
        ? toPullRequest({ id: row.pullRequestId, owner: prOwner, repo: prRepo, number: prNumber, title: prTitle, state: prState })
        : null,
    planItems: row.planItems,
    issues: row.issues,
  };
}

/** BR-17: date, description, area, one or more people; optional PR; any number of plan items and issues. */
const entryInput = z.object({
  workDate: requiredDate('Date'),
  description: requiredText('Description', 2000),
  areaId: optionalId,
  personIds: idList('person', { min: 1 }),
  prUrl: z
    .string()
    .trim()
    .max(300, 'That link is too long.')
    .nullish()
    .transform((value) => value ?? ''),
  planItemIds: idList('plan item'),
  issueIds: idList('issue'),
  // BR-41: a ticked checkbox posts "on"; anything else means no.
  resolveIssues: z.unknown().optional().transform((value) => value === 'on' || value === 'true' || value === true),
});

type ValidEntry = {
  readonly values: {
    readonly workDate: IsoDate;
    readonly description: string;
    readonly areaId: string | null;
    readonly pullRequestId: string | null;
  };
  readonly links: EntryLinks;
  readonly resolveIssues: boolean;
};

async function validateEntry(deps: PullRequestDeps, projectId: string, input: unknown): Promise<ServiceResult<ValidEntry>> {
  const parsed = parseInput(entryInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  const { prUrl, personIds, planItemIds, issueIds, resolveIssues, ...rest } = parsed.value;
  // BR-19: everything referenced belongs to this project (the database enforces it too).
  const errors = await referenceErrors(deps.db, projectId, { areaId: rest.areaId, personIds, planItemIds, issueIds });
  if (Object.keys(errors).length > 0) {
    return invalid(errors);
  }
  let pullRequestId: string | null = null;
  if (prUrl !== '') {
    const pr = await resolvePullRequest(deps, projectId, prUrl, 'prUrl');
    if (!pr.ok) {
      return pr;
    }
    pullRequestId = pr.value.id;
  }
  return ok({ values: { ...rest, pullRequestId }, links: { personIds, planItemIds, issueIds }, resolveIssues });
}

/**
 * BR-17…BR-20. BR-18: the date is whatever day the work was done, weekends included.
 * BR-20: linking a plan item never changes its status.
 * BR-41: on request, the entry resolves the issues it is linked to — on the day the work
 * was done, by the entry's pull request. Issues already resolved keep their resolution.
 */
export async function createEntry(deps: PullRequestDeps, projectId: string, input: unknown): Promise<ServiceResult<{ readonly id: string }>> {
  const valid = await validateEntry(deps, projectId, input);
  if (!valid.ok) {
    return valid;
  }
  const { values, links, resolveIssues } = valid.value;
  const id = await insertEntry(deps.db, projectId, values, links);
  if (resolveIssues) {
    await Promise.all(links.issueIds.map((issueId) => resolveIssueIfOpen(deps.db, projectId, issueId, values.workDate, values.pullRequestId)));
  }
  return ok({ id });
}

export async function updateEntry(
  deps: PullRequestDeps,
  projectId: string,
  entryId: string,
  input: unknown,
): Promise<ServiceResult<{ readonly id: string }>> {
  if (!isUuid(entryId)) {
    return notFound;
  }
  const valid = await validateEntry(deps, projectId, input);
  if (!valid.ok) {
    return valid;
  }
  const updated = await updateEntryRow(deps.db, projectId, entryId, valid.value.values, valid.value.links);
  return updated ? ok({ id: entryId }) : notFound;
}

/** BR-36 */
export async function deleteEntry(db: Db, projectId: string, entryId: string): Promise<ServiceResult<null>> {
  if (!isUuid(entryId)) {
    return notFound;
  }
  return (await deleteEntryRow(db, projectId, entryId)) ? ok(null) : notFound;
}

export async function getEntry(db: Db, projectId: string, entryId: string): Promise<Entry | null> {
  if (!isUuid(entryId)) {
    return null;
  }
  const [row] = await selectEntries(db, projectId, { id: entryId });
  return row === undefined ? null : toEntry(row);
}

/* -------------------------------------------------------------------- log */

const cursorSchema = z.tuple([z.string(), z.string().max(40), z.uuid()]);

function encodeCursor(row: EntryRow): string {
  return Buffer.from(JSON.stringify([row.workDate, row.createdAt, row.id])).toString('base64url');
}

function decodeCursor(cursor: string): { workDate: IsoDate; createdAt: string; id: string } | undefined {
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    const workDate = parsed.success ? parseIsoDate(parsed.data[0]) : null;
    return parsed.success && workDate !== null && !Number.isNaN(Date.parse(parsed.data[1]))
      ? { workDate, createdAt: parsed.data[1], id: parsed.data[2] }
      : undefined;
  } catch {
    return undefined;
  }
}

const logQuery = z.object({
  areaId: z.uuid().optional().catch(undefined),
  personId: z.uuid().optional().catch(undefined),
  pullRequestId: z.uuid().optional().catch(undefined),
  issueId: z.uuid().optional().catch(undefined),
  planItemId: z.uuid().optional().catch(undefined),
  cursor: z.string().max(200).optional().catch(undefined),
});

export type EntryPage = { readonly entries: readonly Entry[]; readonly nextCursor: string | null };

/** Log screen: newest first, keyset-paginated (docs/02 §13). Unknown filter values are ignored. */
export async function listEntries(db: Db, projectId: string, query: unknown, pageSize = 50): Promise<EntryPage> {
  const parsed = logQuery.safeParse(query);
  const { areaId, personId, pullRequestId, issueId, planItemId, cursor } = parsed.success ? parsed.data : {};
  const before = cursor === undefined ? undefined : decodeCursor(cursor);
  const rows = await selectEntries(db, projectId, {
    ...(areaId === undefined ? {} : { areaId }),
    ...(personId === undefined ? {} : { personId }),
    ...(pullRequestId === undefined ? {} : { pullRequestId }),
    ...(issueId === undefined ? {} : { issueId }),
    ...(planItemId === undefined ? {} : { planItemId }),
    ...(before === undefined ? {} : { before }),
    limit: pageSize + 1,
  });
  const page = rows.slice(0, pageSize);
  const last = page.at(-1);
  return {
    entries: page.map(toEntry),
    nextCursor: rows.length > pageSize && last !== undefined ? encodeCursor(last) : null,
  };
}
