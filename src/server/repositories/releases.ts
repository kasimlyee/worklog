import 'server-only';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import type { Db } from '#src/server/db/client.ts';
import type { PrState, ReleaseStatus } from '#src/server/db/types.ts';
import type { IsoDate } from '#src/server/domain/calendar.ts';

/* Writes below do not open transactions: services compose them inside one. */

export type LinkedPr = {
  readonly id: string;
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
  readonly title: string;
  readonly state: PrState;
};

export type ReleaseRow = {
  readonly id: string;
  readonly version: string;
  readonly status: ReleaseStatus;
  readonly targetDate: IsoDate | null;
  readonly releasedOn: IsoDate | null;
  readonly notes: string;
  readonly pullRequests: readonly LinkedPr[];
};

export type ReleaseFilter = {
  readonly id?: string;
  readonly releasedBetween?: { readonly from: IsoDate; readonly to: IsoDate };
};

/** Releases with their linked PRs in ONE query. Planned first, then most recently released. */
export async function selectReleases(db: Db, projectId: string, filter: ReleaseFilter = {}): Promise<readonly ReleaseRow[]> {
  return await db
    .selectFrom('releases as r')
    .select(['r.id', 'r.version', 'r.status', 'r.targetDate', 'r.releasedOn', 'r.notes'])
    .select((eb) =>
      jsonArrayFrom(
        eb
          .selectFrom('releasePullRequests as rp')
          .innerJoin('pullRequests as pr', 'pr.id', 'rp.pullRequestId')
          .select(['pr.id', 'pr.owner', 'pr.repo', 'pr.number', 'pr.title', 'pr.state'])
          .whereRef('rp.releaseId', '=', 'r.id')
          .orderBy('pr.number'),
      ).as('pullRequests'),
    )
    .where((eb) => {
      const conditions = [eb('r.projectId', '=', projectId)];
      if (filter.id !== undefined) {
        conditions.push(eb('r.id', '=', filter.id));
      }
      if (filter.releasedBetween !== undefined) {
        conditions.push(eb('r.releasedOn', '>=', filter.releasedBetween.from), eb('r.releasedOn', '<=', filter.releasedBetween.to));
      }
      return eb.and(conditions);
    })
    .orderBy((eb) => eb.case().when('r.status', '=', 'planned').then(0).else(1).end())
    .orderBy('r.releasedOn', 'desc')
    .orderBy('r.targetDate')
    .orderBy('r.createdAt', 'desc')
    .execute();
}

export type ReleaseValues = {
  readonly version: string;
  readonly status: ReleaseStatus;
  readonly targetDate: IsoDate | null;
  readonly releasedOn: IsoDate | null;
  readonly notes: string;
};

async function linkPullRequests(db: Db, projectId: string, releaseId: string, pullRequestIds: readonly string[]): Promise<void> {
  await db.deleteFrom('releasePullRequests').where('releaseId', '=', releaseId).execute();
  if (pullRequestIds.length > 0) {
    await db
      .insertInto('releasePullRequests')
      .values(pullRequestIds.map((pullRequestId) => ({ projectId, releaseId, pullRequestId })))
      .execute();
  }
}

export async function insertRelease(db: Db, projectId: string, values: ReleaseValues, pullRequestIds: readonly string[]): Promise<string> {
  const { id } = await db.insertInto('releases').values({ projectId, ...values }).returning('id').executeTakeFirstOrThrow();
  await linkPullRequests(db, projectId, id, pullRequestIds);
  return id;
}

export async function updateReleaseRow(
  db: Db,
  projectId: string,
  id: string,
  values: ReleaseValues,
  pullRequestIds: readonly string[],
): Promise<boolean> {
  const result = await db
    .updateTable('releases')
    .set({ ...values, updatedAt: new Date() })
    .where('id', '=', id)
    .where('projectId', '=', projectId)
    .executeTakeFirst();
  if (result.numUpdatedRows === 0n) {
    return false;
  }
  await linkPullRequests(db, projectId, id, pullRequestIds);
  return true;
}

export async function deleteReleaseRow(db: Db, projectId: string, id: string): Promise<boolean> {
  const result = await db.deleteFrom('releases').where('id', '=', id).where('projectId', '=', projectId).executeTakeFirst();
  return result.numDeletedRows > 0n;
}
