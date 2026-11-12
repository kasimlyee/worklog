import 'server-only';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import type { Db } from '#src/server/db/client.ts';
import type { IssuePriority, IssueStatus, PrState } from '#src/server/db/types.ts';
import type { IsoDate } from '#src/server/domain/calendar.ts';
import type { NamedRef } from './entries.ts';

/* Writes below do not open transactions: services compose them inside one. */

export type IssueRow = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly externalUrl: string | null;
  readonly status: IssueStatus;
  readonly priority: IssuePriority;
  readonly assignedOn: IsoDate;
  readonly deadline: IsoDate;
  readonly resolvedOn: IsoDate | null;
  readonly areaId: string | null;
  readonly areaName: string | null;
  readonly resolvedByPrId: string | null;
  readonly prOwner: string | null;
  readonly prRepo: string | null;
  readonly prNumber: number | null;
  readonly prTitle: string | null;
  readonly prState: PrState | null;
  readonly assignees: readonly NamedRef[];
};

export type IssueFilter = {
  readonly id?: string;
  /** Open issues (not resolved) with a deadline on or before this date. */
  readonly openDeadlineOnOrBefore?: IsoDate;
  readonly openOnly?: boolean;
  /** Resolved within [from, to]. */
  readonly resolvedBetween?: { readonly from: IsoDate; readonly to: IsoDate };
};

/** Issues with area, resolving PR and assignees in ONE query. */
export async function selectIssues(db: Db, projectId: string, filter: IssueFilter = {}): Promise<readonly IssueRow[]> {
  return await db
    .selectFrom('issues as i')
    .leftJoin('areas as a', 'a.id', 'i.areaId')
    .leftJoin('pullRequests as pr', 'pr.id', 'i.resolvedByPrId')
    .select([
      'i.id',
      'i.title',
      'i.description',
      'i.externalUrl',
      'i.status',
      'i.priority',
      'i.assignedOn',
      'i.deadline',
      'i.resolvedOn',
      'i.areaId',
      'a.name as areaName',
      'i.resolvedByPrId',
      'pr.owner as prOwner',
      'pr.repo as prRepo',
      'pr.number as prNumber',
      'pr.title as prTitle',
      'pr.state as prState',
    ])
    .select((eb) =>
      jsonArrayFrom(
        eb
          .selectFrom('issueAssignees as ia')
          .innerJoin('people as p', 'p.id', 'ia.personId')
          .select(['p.id', 'p.name'])
          .whereRef('ia.issueId', '=', 'i.id')
          .orderBy('p.name'),
      ).as('assignees'),
    )
    .where((eb) => {
      const conditions = [eb('i.projectId', '=', projectId)];
      if (filter.id !== undefined) {
        conditions.push(eb('i.id', '=', filter.id));
      }
      if (filter.openOnly === true || filter.openDeadlineOnOrBefore !== undefined) {
        conditions.push(eb('i.status', '<>', 'resolved'));
      }
      if (filter.openDeadlineOnOrBefore !== undefined) {
        conditions.push(eb('i.deadline', '<=', filter.openDeadlineOnOrBefore));
      }
      if (filter.resolvedBetween !== undefined) {
        conditions.push(eb('i.resolvedOn', '>=', filter.resolvedBetween.from), eb('i.resolvedOn', '<=', filter.resolvedBetween.to));
      }
      return eb.and(conditions);
    })
    // Open first, by deadline; then resolved, most recent first.
    .orderBy((eb) => eb.case().when('i.status', '=', 'resolved').then(1).else(0).end())
    .orderBy('i.deadline')
    .orderBy('i.resolvedOn', 'desc')
    .orderBy('i.createdAt')
    .execute();
}

export type IssueValues = {
  readonly title: string;
  readonly description: string;
  readonly priority: IssuePriority;
  readonly externalUrl: string | null;
  readonly areaId: string | null;
  readonly assignedOn: IsoDate;
  readonly deadline: IsoDate;
};

export async function insertIssue(db: Db, projectId: string, values: IssueValues, personIds: readonly string[]): Promise<string> {
  const { id } = await db.insertInto('issues').values({ projectId, ...values }).returning('id').executeTakeFirstOrThrow();
  await db.insertInto('issueAssignees').values(personIds.map((personId) => ({ issueId: id, personId }))).execute();
  return id;
}

export async function updateIssueRow(db: Db, projectId: string, id: string, values: IssueValues, personIds: readonly string[]): Promise<boolean> {
  const result = await db
    .updateTable('issues')
    .set({ ...values, updatedAt: new Date() })
    .where('id', '=', id)
    .where('projectId', '=', projectId)
    .executeTakeFirst();
  if (result.numUpdatedRows === 0n) {
    return false;
  }
  await db.deleteFrom('issueAssignees').where('issueId', '=', id).execute();
  await db.insertInto('issueAssignees').values(personIds.map((personId) => ({ issueId: id, personId }))).execute();
  return true;
}

export async function updateIssueStatus(
  db: Db,
  projectId: string,
  id: string,
  values: { readonly status: IssueStatus; readonly resolvedOn: IsoDate | null; readonly resolvedByPrId: string | null },
): Promise<boolean> {
  const result = await db
    .updateTable('issues')
    .set({ ...values, updatedAt: new Date() })
    .where('id', '=', id)
    .where('projectId', '=', projectId)
    .executeTakeFirst();
  return result.numUpdatedRows > 0n;
}

/**
 * BR-39, BR-41: resolve an issue unless it already is (an existing resolution is kept as it
 * is). BR-41 also records the pull request that resolved it.
 */
export async function resolveIssueIfOpen(db: Db, projectId: string, id: string, resolvedOn: IsoDate, resolvedByPrId: string | null = null): Promise<void> {
  await db
    .updateTable('issues')
    .set({ status: 'resolved', resolvedOn, ...(resolvedByPrId === null ? {} : { resolvedByPrId }), updatedAt: new Date() })
    .where('id', '=', id)
    .where('projectId', '=', projectId)
    .where('status', '<>', 'resolved')
    .execute();
}

export async function deleteIssueRow(db: Db, projectId: string, id: string): Promise<boolean> {
  const result = await db.deleteFrom('issues').where('id', '=', id).where('projectId', '=', projectId).executeTakeFirst();
  return result.numDeletedRows > 0n;
}
