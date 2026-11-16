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
  /** BR-46: every pull request the work went into, in the order they were given. */
  readonly pullRequests: readonly EntryPullRequestRow[];
  /** BR-17: the plan items this entry works on and the issues it works on — any number. */
  readonly planItems: readonly EntryPlanItemRow[];
  readonly issues: readonly EntryIssueRow[];
  readonly people: readonly NamedRef[];
};

export type EntryPullRequestRow = {
  readonly id: string;
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
  readonly title: string;
  readonly state: PrState;
};

/** BR-45: `completes` — this entry finished the item. */
export type EntryPlanItemRow = { readonly id: string; readonly title: string; readonly completes: boolean };

/** BR-44: short Issue / Cause / Fix summaries, and whether this entry fixed it. */
export type EntryIssueRow = {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly cause: string;
  readonly fix: string;
  readonly resolves: boolean;
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
  /** Words to find in the description, the Issue / Cause / Fix notes, linked issue titles or PR titles. */
  readonly search?: string;
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
    .select([
      'e.id',
      'e.workDate',
      'e.description',
      // Text keeps microseconds, so keyset pagination never skips or repeats a row.
      sql<string>`e.created_at::text`.as('createdAt'),
      'e.areaId',
      'a.name as areaName',
    ])
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom('entryPullRequests as epr')
          .innerJoin('pullRequests as pr', 'pr.id', 'epr.pullRequestId')
          .select(['pr.id', 'pr.owner', 'pr.repo', 'pr.number', 'pr.title', 'pr.state'])
          .whereRef('epr.entryId', '=', 'e.id')
          .orderBy('pr.repo')
          .orderBy('pr.number'),
      ).as('pullRequests'),
      jsonArrayFrom(
        eb
          .selectFrom('entryPlanItems as epi')
          .innerJoin('planItems as pi', 'pi.id', 'epi.planItemId')
          .select(['pi.id', 'pi.title', 'epi.completes'])
          .whereRef('epi.entryId', '=', 'e.id')
          .orderBy('pi.dueDate')
          .orderBy('pi.title'),
      ).as('planItems'),
      jsonArrayFrom(
        eb
          .selectFrom('entryIssues as ei')
          .innerJoin('issues as i', 'i.id', 'ei.issueId')
          .select(['i.id', 'i.title', 'ei.summary', 'ei.cause', 'ei.fix', 'ei.resolves'])
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
        const pullRequestId = filter.pullRequestId;
        conditions.push(
          eb.exists(
            eb.selectFrom('entryPullRequests as fr').select('fr.entryId').whereRef('fr.entryId', '=', 'e.id').where('fr.pullRequestId', '=', pullRequestId),
          ),
        );
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
      if (filter.search !== undefined) {
        const like = `%${filter.search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
        conditions.push(
          eb.or([
            eb('e.description', 'ilike', like),
            eb.exists(
              eb
                .selectFrom('entryIssues as si')
                .innerJoin('issues as sx', 'sx.id', 'si.issueId')
                .select('si.entryId')
                .whereRef('si.entryId', '=', 'e.id')
                .where((inner) =>
                  inner.or([inner('si.summary', 'ilike', like), inner('si.cause', 'ilike', like), inner('si.fix', 'ilike', like), inner('sx.title', 'ilike', like)]),
                ),
            ),
            eb.exists(
              eb
                .selectFrom('entryPullRequests as sp')
                .innerJoin('pullRequests as spr', 'spr.id', 'sp.pullRequestId')
                .select('sp.entryId')
                .whereRef('sp.entryId', '=', 'e.id')
                .where('spr.title', 'ilike', like),
            ),
          ]),
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
};

/** BR-44 */
export type IssueLink = { readonly issueId: string; readonly summary: string; readonly cause: string; readonly fix: string; readonly resolves: boolean };
/** BR-45 */
export type PlanItemLink = { readonly planItemId: string; readonly completes: boolean };

export type EntryLinks = {
  readonly personIds: readonly string[];
  /** BR-46: the first is also kept in the legacy entries.pull_request_id column. */
  readonly pullRequestIds: readonly string[];
  readonly planItems: readonly PlanItemLink[];
  readonly issues: readonly IssueLink[];
};

async function replaceLinks(db: Db, projectId: string, entryId: string, links: EntryLinks): Promise<void> {
  await db.deleteFrom('entryPeople').where('entryId', '=', entryId).execute();
  await db.deleteFrom('entryPullRequests').where('entryId', '=', entryId).execute();
  await db.deleteFrom('entryPlanItems').where('entryId', '=', entryId).execute();
  await db.deleteFrom('entryIssues').where('entryId', '=', entryId).execute();
  await db.insertInto('entryPeople').values(links.personIds.map((personId) => ({ entryId, personId }))).execute();
  if (links.pullRequestIds.length > 0) {
    await db
      .insertInto('entryPullRequests')
      .values(links.pullRequestIds.map((pullRequestId) => ({ projectId, entryId, pullRequestId })))
      .execute();
  }
  if (links.planItems.length > 0) {
    await db.insertInto('entryPlanItems').values(links.planItems.map((link) => ({ projectId, entryId, ...link }))).execute();
  }
  if (links.issues.length > 0) {
    await db.insertInto('entryIssues').values(links.issues.map((link) => ({ projectId, entryId, ...link }))).execute();
  }
}

// The single-link columns plan_item_id / issue_id are superseded by the link tables
// (migration 0005) and always written as NULL; pull_request_id keeps the first PR (0006).
function legacyColumns(links: EntryLinks) {
  return { planItemId: null, issueId: null, pullRequestId: links.pullRequestIds[0] ?? null } as const;
}

/** Call inside a transaction. */
export async function insertEntry(db: Db, projectId: string, values: EntryValues, links: EntryLinks): Promise<string> {
  const { id } = await db
    .insertInto('entries')
    .values({ projectId, ...values, ...legacyColumns(links) })
    .returning('id')
    .executeTakeFirstOrThrow();
  await replaceLinks(db, projectId, id, links);
  return id;
}

/** Call inside a transaction. */
export async function updateEntryRow(db: Db, projectId: string, id: string, values: EntryValues, links: EntryLinks): Promise<boolean> {
  const updated = await db
    .updateTable('entries')
    .set({ ...values, ...legacyColumns(links), updatedAt: new Date() })
    .where('id', '=', id)
    .where('projectId', '=', projectId)
    .executeTakeFirst();
  if (updated.numUpdatedRows === 0n) {
    return false;
  }
  await replaceLinks(db, projectId, id, links);
  return true;
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
