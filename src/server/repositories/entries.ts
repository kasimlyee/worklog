import 'server-only';
import { sql } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import type { Db } from '#src/server/db/client.ts';
import type { PrState } from '#src/server/db/types.ts';
import type { IsoDate } from '#src/server/domain/calendar.ts';

export type NamedRef = { readonly id: string; readonly name: string };

export type EntryRow = {
  readonly id: string;
  readonly workDate: IsoDate;
  readonly description: string;
  readonly createdAt: string;
  readonly areaId: string | null;
  readonly areaName: string | null;
  readonly pullRequestId: string | null;
  readonly prOwner: string | null;
  readonly prRepo: string | null;
  readonly prNumber: number | null;
  readonly prTitle: string | null;
  readonly prState: PrState | null;
  /** BR-17: the plan items this entry fulfils and the issues it relates to — any number. */
  readonly planItems: readonly { readonly id: string; readonly title: string }[];
  readonly issues: readonly { readonly id: string; readonly title: string }[];
  readonly people: readonly NamedRef[];
};

export type EntryFilter = {
  readonly id?: string;
  readonly from?: IsoDate;
  readonly to?: IsoDate;
  readonly areaId?: string;
  readonly personId?: string;
  readonly pullRequestId?: string;
  readonly planItemId?: string;
  readonly issueId?: string;
  /** Keyset: rows strictly before this position in newest-first order. */
  readonly before?: { readonly workDate: IsoDate; readonly createdAt: string; readonly id: string };
  readonly limit?: number;
  readonly order?: 'newest' | 'oldest';
};

/**
 * Entries with everything a list or report shows, in ONE query: people come from a
 * nested json array, never a query per row (docs/03 §7).
 */
export async function selectEntries(db: Db, projectId: string, filter: EntryFilter = {}): Promise<readonly EntryRow[]> {
  const direction = filter.order === 'oldest' ? 'asc' : 'desc';
  return await db
    .selectFrom('entries as e')
    .leftJoin('areas as a', 'a.id', 'e.areaId')
    .leftJoin('pullRequests as pr', 'pr.id', 'e.pullRequestId')
    .select([
      'e.id',
      'e.workDate',
      'e.description',
      // Text keeps microseconds, so keyset pagination never skips or repeats a row.
      sql<string>`e.created_at::text`.as('createdAt'),
      'e.areaId',
      'a.name as areaName',
      'e.pullRequestId',
      'pr.owner as prOwner',
      'pr.repo as prRepo',
      'pr.number as prNumber',
      'pr.title as prTitle',
      'pr.state as prState',
    ])
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom('entryPlanItems as epi')
          .innerJoin('planItems as pi', 'pi.id', 'epi.planItemId')
          .select(['pi.id', 'pi.title'])
          .whereRef('epi.entryId', '=', 'e.id')
          .orderBy('pi.dueDate')
          .orderBy('pi.title'),
      ).as('planItems'),
      jsonArrayFrom(
        eb
          .selectFrom('entryIssues as ei')
          .innerJoin('issues as i', 'i.id', 'ei.issueId')
          .select(['i.id', 'i.title'])
          .whereRef('ei.entryId', '=', 'e.id')
          .orderBy('i.deadline')
          .orderBy('i.title'),
      ).as('issues'),
    ])
    .select((eb) =>
      jsonArrayFrom(
        eb
          .selectFrom('entryPeople as ep')
          .innerJoin('people as p', 'p.id', 'ep.personId')
          .select(['p.id', 'p.name'])
          .whereRef('ep.entryId', '=', 'e.id')
          .orderBy('p.name'),
      ).as('people'),
    )
    .where((eb) => {
      const { before } = filter;
      const conditions = [eb('e.projectId', '=', projectId)];
      if (filter.id !== undefined) {
        conditions.push(eb('e.id', '=', filter.id));
      }
      if (filter.from !== undefined) {
        conditions.push(eb('e.workDate', '>=', filter.from));
      }
      if (filter.to !== undefined) {
        conditions.push(eb('e.workDate', '<=', filter.to));
      }
      if (filter.areaId !== undefined) {
        conditions.push(eb('e.areaId', '=', filter.areaId));
      }
      if (filter.pullRequestId !== undefined) {
        conditions.push(eb('e.pullRequestId', '=', filter.pullRequestId));
      }
      if (filter.planItemId !== undefined) {
        const planItemId = filter.planItemId;
        conditions.push(
          eb.exists(eb.selectFrom('entryPlanItems as fp').select('fp.entryId').whereRef('fp.entryId', '=', 'e.id').where('fp.planItemId', '=', planItemId)),
        );
      }
      if (filter.issueId !== undefined) {
        const issueId = filter.issueId;
        conditions.push(
          eb.exists(eb.selectFrom('entryIssues as fi').select('fi.entryId').whereRef('fi.entryId', '=', 'e.id').where('fi.issueId', '=', issueId)),
        );
      }
      if (filter.personId !== undefined) {
        conditions.push(
          eb.exists(
            eb.selectFrom('entryPeople as f').select('f.entryId').whereRef('f.entryId', '=', 'e.id').where('f.personId', '=', filter.personId),
          ),
        );
      }
      if (before !== undefined) {
        conditions.push(
          eb(
            sql`(e.work_date, e.created_at, e.id)`,
            '<',
            sql`(${before.workDate}::date, ${before.createdAt}::timestamptz, ${before.id}::uuid)`,
          ),
        );
      }
      return eb.and(conditions);
    })
    .orderBy('e.workDate', direction)
    .orderBy('e.createdAt', direction)
    .orderBy('e.id', direction)
    .$if(filter.limit !== undefined, (q) => q.limit(Number(filter.limit)))
    .execute();
}

export type EntryValues = {
  readonly workDate: IsoDate;
  readonly description: string;
  readonly areaId: string | null;
  readonly pullRequestId: string | null;
};

export type EntryLinks = {
  readonly personIds: readonly string[];
  readonly planItemIds: readonly string[];
  readonly issueIds: readonly string[];
};

async function replaceLinks(db: Db, projectId: string, entryId: string, links: EntryLinks): Promise<void> {
  await db.deleteFrom('entryPeople').where('entryId', '=', entryId).execute();
  await db.deleteFrom('entryPlanItems').where('entryId', '=', entryId).execute();
  await db.deleteFrom('entryIssues').where('entryId', '=', entryId).execute();
  await db.insertInto('entryPeople').values(links.personIds.map((personId) => ({ entryId, personId }))).execute();
  if (links.planItemIds.length > 0) {
    await db.insertInto('entryPlanItems').values(links.planItemIds.map((planItemId) => ({ projectId, entryId, planItemId }))).execute();
  }
  if (links.issueIds.length > 0) {
    await db.insertInto('entryIssues').values(links.issueIds.map((issueId) => ({ projectId, entryId, issueId }))).execute();
  }
}

// The single-link columns plan_item_id / issue_id are superseded by the link tables
// (migration 0005) and always written as NULL.
const noLegacyLinks = { planItemId: null, issueId: null } as const;

export async function insertEntry(db: Db, projectId: string, values: EntryValues, links: EntryLinks): Promise<string> {
  return await db.transaction().execute(async (trx) => {
    const { id } = await trx.insertInto('entries').values({ projectId, ...values, ...noLegacyLinks }).returning('id').executeTakeFirstOrThrow();
    await replaceLinks(trx, projectId, id, links);
    return id;
  });
}

export async function updateEntryRow(db: Db, projectId: string, id: string, values: EntryValues, links: EntryLinks): Promise<boolean> {
  return await db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable('entries')
      .set({ ...values, ...noLegacyLinks, updatedAt: new Date() })
      .where('id', '=', id)
      .where('projectId', '=', projectId)
      .executeTakeFirst();
    if (updated.numUpdatedRows === 0n) {
      return false;
    }
    await replaceLinks(trx, projectId, id, links);
    return true;
  });
}

/** How many entries fall within [from, to] — for the dashboard's pulse. */
export async function countEntries(db: Db, projectId: string, from: IsoDate, to: IsoDate): Promise<number> {
  const row = await db
    .selectFrom('entries')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('projectId', '=', projectId)
    .where('workDate', '>=', from)
    .where('workDate', '<=', to)
    .executeTakeFirstOrThrow();
  return Number(row.n);
}

export async function deleteEntryRow(db: Db, projectId: string, id: string): Promise<boolean> {
  const result = await db.deleteFrom('entries').where('id', '=', id).where('projectId', '=', projectId).executeTakeFirst();
  return result.numDeletedRows > 0n;
}
