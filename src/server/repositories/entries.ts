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
  readonly planItemId: string | null;
  readonly planItemTitle: string | null;
  readonly issueId: string | null;
  readonly issueTitle: string | null;
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
    .leftJoin('planItems as pi', 'pi.id', 'e.planItemId')
    .leftJoin('issues as i', 'i.id', 'e.issueId')
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
      'e.planItemId',
      'pi.title as planItemTitle',
      'e.issueId',
      'i.title as issueTitle',
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
        conditions.push(eb('e.planItemId', '=', filter.planItemId));
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
  readonly planItemId: string | null;
  readonly issueId: string | null;
};

export async function insertEntry(db: Db, projectId: string, values: EntryValues, personIds: readonly string[]): Promise<string> {
  return await db.transaction().execute(async (trx) => {
    const { id } = await trx.insertInto('entries').values({ projectId, ...values }).returning('id').executeTakeFirstOrThrow();
    await trx.insertInto('entryPeople').values(personIds.map((personId) => ({ entryId: id, personId }))).execute();
    return id;
  });
}

export async function updateEntryRow(
  db: Db,
  projectId: string,
  id: string,
  values: EntryValues,
  personIds: readonly string[],
): Promise<boolean> {
  return await db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable('entries')
      .set({ ...values, updatedAt: new Date() })
      .where('id', '=', id)
      .where('projectId', '=', projectId)
      .executeTakeFirst();
    if (updated.numUpdatedRows === 0n) {
      return false;
    }
    await trx.deleteFrom('entryPeople').where('entryId', '=', id).execute();
    await trx.insertInto('entryPeople').values(personIds.map((personId) => ({ entryId: id, personId }))).execute();
    return true;
  });
}

export async function deleteEntryRow(db: Db, projectId: string, id: string): Promise<boolean> {
  const result = await db.deleteFrom('entries').where('id', '=', id).where('projectId', '=', projectId).executeTakeFirst();
  return result.numDeletedRows > 0n;
}
