import 'server-only';
import * as z from 'zod';
import { ok } from '#src/lib/result.ts';
import type { Db } from '#src/server/db/client.ts';
import type { IssuePriority, IssueStatus } from '#src/server/db/types.ts';
import type { IsoDate } from '#src/server/domain/calendar.ts';
import { issueDeadline, type Deadline, type IssueDeadlineState } from '#src/server/domain/deadlines.ts';
import type { NamedRef } from '#src/server/repositories/entries.ts';
import {
  deleteIssueRow, insertIssue, selectIssues, updateIssueRow, updateIssueStatus, type IssueRow,
} from '#src/server/repositories/issues.ts';
import { invalid, notFound, parseInput, type ServiceResult } from './errors.ts';
import { idList, isUuid, oneOf, optionalDate, optionalId, optionalWebUrl, requiredDate, requiredText } from './fields.ts';
import { toPullRequest, type PullRequest } from './pull-requests.ts';
import { referenceErrors } from './references.ts';

export const issuePriorities = ['low', 'medium', 'high', 'urgent'] as const satisfies readonly IssuePriority[];

/** BR-37: urgent first. */
export const priorityRank: Readonly<Record<IssuePriority, number>> = { urgent: 0, high: 1, medium: 2, low: 3 };

export type Issue = {
  readonly id: string;
  readonly title: string;
  readonly externalUrl: string | null;
  readonly status: IssueStatus;
  readonly priority: IssuePriority;
  readonly assignedOn: IsoDate;
  readonly deadline: IsoDate;
  readonly resolvedOn: IsoDate | null;
  readonly area: NamedRef | null;
  readonly resolvedBy: PullRequest | null;
  readonly assignees: readonly NamedRef[];
  /** BR-31, computed for `today`. */
  readonly deadlineState: Deadline<IssueDeadlineState>;
};

export function toIssue(row: IssueRow, today: IsoDate): Issue {
  const { prOwner, prRepo, prNumber, prTitle, prState } = row;
  return {
    id: row.id,
    title: row.title,
    externalUrl: row.externalUrl,
    status: row.status,
    priority: row.priority,
    assignedOn: row.assignedOn,
    deadline: row.deadline,
    resolvedOn: row.resolvedOn,
    area: row.areaId !== null && row.areaName !== null ? { id: row.areaId, name: row.areaName } : null,
    resolvedBy:
      row.resolvedByPrId !== null && prOwner !== null && prRepo !== null && prNumber !== null && prTitle !== null && prState !== null
        ? toPullRequest({ id: row.resolvedByPrId, owner: prOwner, repo: prRepo, number: prNumber, title: prTitle, state: prState })
        : null,
    assignees: row.assignees,
    deadlineState: issueDeadline(row, today),
  };
}

export async function listIssues(db: Db, projectId: string, today: IsoDate, { openOnly = false } = {}): Promise<readonly Issue[]> {
  return (await selectIssues(db, projectId, { openOnly })).map((row) => toIssue(row, today));
}

export async function getIssue(db: Db, projectId: string, issueId: string, today: IsoDate): Promise<Issue | null> {
  if (!isUuid(issueId)) {
    return null;
  }
  const [row] = await selectIssues(db, projectId, { id: issueId });
  return row === undefined ? null : toIssue(row, today);
}

/** BR-27: short title, optional link and area, one or more assignees, assigned date and deadline. */
const issueInput = z
  .object({
    title: requiredText('Title', 200),
    // BR-37: medium unless chosen.
    priority: z
      .preprocess((value) => (value === '' ? undefined : value), oneOf(issuePriorities, 'priority').optional())
      .transform((value) => value ?? 'medium'),
    externalUrl: optionalWebUrl('Link'),
    areaId: optionalId,
    personIds: idList('assignee', { min: 1 }),
    assignedOn: requiredDate('Assigned date'),
    deadline: requiredDate('Deadline'),
  })
  // BR-28
  .refine((issue) => issue.deadline >= issue.assignedOn, { message: 'The deadline must be on or after the assigned date.', path: ['deadline'] });

async function validIssue(db: Db, projectId: string, input: unknown) {
  const parsed = parseInput(issueInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  const { personIds, ...values } = parsed.value;
  const errors = await referenceErrors(db, projectId, { areaId: values.areaId, personIds });
  return Object.keys(errors).length > 0 ? invalid(errors) : ok({ values, personIds });
}

export async function createIssue(db: Db, projectId: string, input: unknown): Promise<ServiceResult<{ readonly id: string }>> {
  const valid = await validIssue(db, projectId, input);
  if (!valid.ok) {
    return valid;
  }
  const { values, personIds } = valid.value;
  return ok({ id: await db.transaction().execute(async (trx) => await insertIssue(trx, projectId, values, personIds)) });
}

export async function updateIssue(db: Db, projectId: string, issueId: string, input: unknown): Promise<ServiceResult<{ readonly id: string }>> {
  if (!isUuid(issueId)) {
    return notFound;
  }
  const valid = await validIssue(db, projectId, input);
  if (!valid.ok) {
    return valid;
  }
  const { values, personIds } = valid.value;
  const updated = await db.transaction().execute(async (trx) => await updateIssueRow(trx, projectId, issueId, values, personIds));
  return updated ? ok({ id: issueId }) : notFound;
}

const resolveInput = z.object({ resolvedOn: optionalDate('Resolved date'), resolvedByPrId: optionalId });

/** BR-29: resolved_on defaults to today and is editable. BR-30: optionally the PR that resolved it. */
export async function resolveIssue(
  db: Db,
  projectId: string,
  issueId: string,
  input: unknown,
  today: IsoDate,
): Promise<ServiceResult<{ readonly id: string }>> {
  if (!isUuid(issueId)) {
    return notFound;
  }
  const parsed = parseInput(resolveInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  const resolvedOn = parsed.value.resolvedOn ?? today;
  if (resolvedOn > today) {
    return invalid({ resolvedOn: 'The resolved date cannot be in the future.' });
  }
  const { resolvedByPrId } = parsed.value;
  const errors = await referenceErrors(db, projectId, { pullRequestId: resolvedByPrId });
  if (Object.keys(errors).length > 0) {
    return invalid({ resolvedByPrId: errors['pullRequestId'] ?? '' });
  }
  const updated = await updateIssueStatus(db, projectId, issueId, { status: 'resolved', resolvedOn, resolvedByPrId });
  return updated ? ok({ id: issueId }) : notFound;
}

const statusInput = z.object({ status: oneOf(['open', 'in_progress'], 'status') });

/** Open or in progress. Moving away from resolved is reopening: BR-29 clears resolved_on. */
export async function setIssueStatus(db: Db, projectId: string, issueId: string, input: unknown): Promise<ServiceResult<{ readonly id: string }>> {
  if (!isUuid(issueId)) {
    return notFound;
  }
  const parsed = parseInput(statusInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  const updated = await updateIssueStatus(db, projectId, issueId, { status: parsed.value.status, resolvedOn: null, resolvedByPrId: null });
  return updated ? ok({ id: issueId }) : notFound;
}

/** BR-36 */
export async function deleteIssue(db: Db, projectId: string, issueId: string): Promise<ServiceResult<null>> {
  if (!isUuid(issueId)) {
    return notFound;
  }
  return (await deleteIssueRow(db, projectId, issueId)) ? ok(null) : notFound;
}
