import 'server-only';
import * as z from 'zod';
import { ok } from '#src/lib/result.ts';
import type { Db } from '#src/server/db/client.ts';
import { parseIsoDate, type IsoDate } from '#src/server/domain/calendar.ts';
import {
  deleteEntryRow, insertEntry, selectEntries, updateEntryRow,
  type EntryIssueRow, type EntryLinks, type EntryPlanItemRow, type EntryRow, type EntryValues, type IssueLink, type NamedRef, type PlanItemLink,
} from '#src/server/repositories/entries.ts';
import { completeIssuePlanItems, completePlanItemIfOpen } from '#src/server/repositories/plans.ts';
import { resolveIssueIfOpen } from '#src/server/repositories/issues.ts';
import { invalid, notFound, parseInput, type ServiceResult } from './errors.ts';
import { idList, isUuid, optionalId, optionalText, requiredDate, requiredText } from './fields.ts';
import { resolvePullRequest, toPullRequest, type PullRequest, type PullRequestDeps } from './pull-requests.ts';
import { referenceErrors } from './references.ts';

export type Entry = {
  readonly id: string;
  readonly workDate: IsoDate;
  readonly description: string;
  readonly area: NamedRef | null;
  readonly people: readonly NamedRef[];
  /** BR-46: one piece of work can span several pull requests (front end and back end). */
  readonly pullRequests: readonly PullRequest[];
  /** BR-17: any number of each — one PR often carries several fixes. BR-44/BR-45: what each link closed. */
  readonly planItems: readonly EntryPlanItemRow[];
  readonly issues: readonly EntryIssueRow[];
};

export function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    workDate: row.workDate,
    description: row.description,
    area: row.areaId !== null && row.areaName !== null ? { id: row.areaId, name: row.areaName } : null,
    people: row.people,
    pullRequests: row.pullRequests.map(toPullRequest),
    planItems: row.planItems,
    issues: row.issues,
  };
}

/** BR-46: at most this many pull request links on one entry. */
export const maxPullRequests = 5;

const ticked = z.unknown().optional().transform((value) => value === 'on' || value === 'true' || value === true);

/** BR-17: date, description, area, one or more people; any number of PRs, plan items and issues. */
const entryInput = z.object({
  workDate: requiredDate('Date'),
  description: requiredText('Description', 2000),
  areaId: optionalId,
  personIds: idList('person', { min: 1 }),
  // BR-46: one link per line; `prUrl` is the single-link form kept for older callers.
  prUrls: z.string().max(2000, 'Too many links.').nullish().transform((value) => value ?? ''),
  prUrl: z.string().max(300, 'That link is too long.').nullish().transform((value) => value ?? ''),
  planItemIds: idList('plan item'),
  issueIds: idList('issue'),
});

/** BR-44: the per-issue fields, posted as `issue.<id>.summary` and so on. */
const issueDetail = z.object({
  summary: optionalText('Issue', 1000),
  cause: optionalText('Cause', 1000),
  fix: optionalText('Fix', 1000),
  resolves: ticked,
});

export function issueField(issueId: string, name: 'summary' | 'cause' | 'fix' | 'resolves'): string {
  return `issue.${issueId}.${name}`;
}

export function planItemField(planItemId: string): string {
  return `planItem.${planItemId}.completes`;
}

function prLinks(prUrls: string, prUrl: string): readonly string[] {
  const all = [...prUrls.split(/\s+/), prUrl.trim()].filter((url) => url !== '');
  return [...new Set(all)];
}

type ValidEntry = { readonly values: EntryValues; readonly links: EntryLinks };

async function validateEntry(deps: PullRequestDeps, projectId: string, input: unknown): Promise<ServiceResult<ValidEntry>> {
  const parsed = parseInput(entryInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  const { prUrls, prUrl, personIds, planItemIds, issueIds, ...values } = parsed.value;
  const raw = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const errors: Record<string, string> = {};

  const issues: IssueLink[] = [];
  for (const issueId of issueIds) {
    const detail = issueDetail.safeParse({
      summary: raw[issueField(issueId, 'summary')],
      cause: raw[issueField(issueId, 'cause')],
      fix: raw[issueField(issueId, 'fix')],
      resolves: raw[issueField(issueId, 'resolves')],
    });
    if (!detail.success) {
      for (const issue of detail.error.issues) {
        errors[issueField(issueId, String(issue.path[0]) as 'summary')] = issue.message;
      }
      continue;
    }
    issues.push({ issueId, ...detail.data });
  }
  const planItems: PlanItemLink[] = planItemIds.map((planItemId) => ({
    planItemId,
    completes: ticked.parse(raw[planItemField(planItemId)]),
  }));

  const urls = prLinks(prUrls, prUrl);
  if (urls.length > maxPullRequests) {
    errors['prUrls'] = `Link at most ${String(maxPullRequests)} pull requests.`;
  }
  if (Object.keys(errors).length > 0) {
    return invalid(errors);
  }
  // BR-19: everything referenced belongs to this project (the database enforces it too).
  const refErrors = await referenceErrors(deps.db, projectId, { areaId: values.areaId, personIds, planItemIds, issueIds });
  if (Object.keys(refErrors).length > 0) {
    return invalid(refErrors);
  }
  const pullRequestIds: string[] = [];
  for (const url of urls) {
    const pr = await resolvePullRequest(deps, projectId, url, 'prUrls');
    if (!pr.ok) {
      return urls.length > 1 && pr.error.code === 'invalid'
        ? invalid({ prUrls: `${url}: ${pr.error.fieldErrors['prUrls'] ?? 'not a usable link.'}` })
        : pr;
    }
    pullRequestIds.push(pr.value.id);
  }
  return ok({ values, links: { personIds, pullRequestIds, planItems, issues } });
}

/**
 * BR-44/BR-45: a log is how work gets closed. Issues it says it fixes are resolved and plan
 * items it says it finishes are done — as of the day the work was done, by its first pull
 * request. Work already closed keeps its closure; unticking never reopens (reopen explicitly).
 * BR-39: finishing a plan item made from an issue resolves that issue too.
 */
async function applyClosures(db: Db, projectId: string, values: EntryValues, links: EntryLinks): Promise<void> {
  const byPr = links.pullRequestIds[0] ?? null;
  for (const link of links.issues) {
    if (link.resolves) {
      await resolveIssueIfOpen(db, projectId, link.issueId, values.workDate, byPr);
      // BR-50: the plan items working on it are finished with it.
      await completeIssuePlanItems(db, projectId, link.issueId, values.workDate);
    }
  }
  for (const link of links.planItems) {
    if (link.completes) {
      const done = await completePlanItemIfOpen(db, projectId, link.planItemId, values.workDate);
      if (done !== undefined && done.issueId !== null) {
        await resolveIssueIfOpen(db, projectId, done.issueId, values.workDate, byPr);
      }
    }
  }
}

/**
 * BR-17…BR-20, BR-44…BR-46. BR-18: the date is whatever day the work was done, weekends
 * included. BR-20: linking a plan item or issue without ticking it closed changes nothing.
 */
export async function createEntry(deps: PullRequestDeps, projectId: string, input: unknown): Promise<ServiceResult<{ readonly id: string }>> {
  const valid = await validateEntry(deps, projectId, input);
  if (!valid.ok) {
    return valid;
  }
  const { values, links } = valid.value;
  const id = await deps.db.transaction().execute(async (trx) => {
    const entryId = await insertEntry(trx, projectId, values, links);
    await applyClosures(trx, projectId, values, links);
    return entryId;
  });
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
  const { values, links } = valid.value;
  const updated = await deps.db.transaction().execute(async (trx) => {
    if (!(await updateEntryRow(trx, projectId, entryId, values, links))) {
      return false;
    }
    await applyClosures(trx, projectId, values, links);
    return true;
  });
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
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .catch(undefined)
    .transform((value) => (value === '' ? undefined : value)),
  cursor: z.string().max(200).optional().catch(undefined),
});

export type EntryPage = { readonly entries: readonly Entry[]; readonly nextCursor: string | null };

/** Log screen: newest first, keyset-paginated (docs/02 §13). Unknown filter values are ignored. */
export async function listEntries(db: Db, projectId: string, query: unknown, pageSize = 50): Promise<EntryPage> {
  const parsed = logQuery.safeParse(query);
  const { areaId, personId, pullRequestId, issueId, planItemId, q, cursor } = parsed.success ? parsed.data : {};
  const before = cursor === undefined ? undefined : decodeCursor(cursor);
  const rows = await selectEntries(db, projectId, {
    ...(areaId === undefined ? {} : { areaId }),
    ...(personId === undefined ? {} : { personId }),
    ...(pullRequestId === undefined ? {} : { pullRequestId }),
    ...(issueId === undefined ? {} : { issueId }),
    ...(planItemId === undefined ? {} : { planItemId }),
    ...(q === undefined ? {} : { search: q }),
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
