import 'server-only';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import type { Db } from '#src/server/db/client.ts';
import type { IsoDate } from '#src/server/domain/calendar.ts';

export type ProjectChromeRow = {
  readonly areas: readonly { readonly id: string; readonly name: string }[];
  readonly people: readonly { readonly id: string; readonly name: string }[];
  readonly planItems: readonly { readonly id: string; readonly title: string; readonly dueDate: IsoDate }[];
  readonly issues: readonly { readonly id: string; readonly title: string }[];
  readonly pullRequests: readonly { readonly id: string; readonly repo: string; readonly number: number; readonly title: string }[];
  readonly releases: readonly { readonly id: string; readonly version: string }[];
  readonly overdueItems: number;
  readonly overdueIssues: number;
};

/**
 * Everything every project page needs around its content — the option lists of the quick
 * log and other forms, and the red overdue count — in ONE round trip (NF-01).
 */
export async function selectProjectChrome(db: Db, projectId: string, overdueCutoff: IsoDate, planItemLimit: number): Promise<ProjectChromeRow> {
  const row = await db
    .selectNoFrom((eb) => [
      jsonArrayFrom(
        eb.selectFrom('areas').select(['id', 'name']).where('projectId', '=', projectId).where('archivedAt', 'is', null).orderBy('position'),
      ).as('areas'),
      jsonArrayFrom(eb.selectFrom('people').select(['id', 'name']).where('archivedAt', 'is', null).orderBy('name')).as('people'),
      jsonArrayFrom(
        eb
          .selectFrom('planItems')
          .select(['id', 'title', 'dueDate'])
          .where('projectId', '=', projectId)
          .where('status', '<>', 'done')
          .orderBy('dueDate')
          .orderBy('position')
          .limit(planItemLimit),
      ).as('planItems'),
      jsonArrayFrom(
        eb.selectFrom('issues').select(['id', 'title']).where('projectId', '=', projectId).where('status', '<>', 'resolved').orderBy('deadline'),
      ).as('issues'),
      jsonArrayFrom(
        eb
          .selectFrom('pullRequests')
          .select(['id', 'repo', 'number', 'title'])
          .where('projectId', '=', projectId)
          .orderBy('repo')
          .orderBy('number', 'desc'),
      ).as('pullRequests'),
      jsonArrayFrom(
        eb.selectFrom('releases').select(['id', 'version']).where('projectId', '=', projectId).orderBy('createdAt', 'desc'),
      ).as('releases'),
      eb
        .selectFrom('planItems')
        .select((s) => s.fn.countAll<string>().as('n'))
        .where('projectId', '=', projectId)
        .where('status', '<>', 'done')
        .where('dueDate', '<', overdueCutoff)
        .as('overdueItems'),
      eb
        .selectFrom('issues')
        .select((s) => s.fn.countAll<string>().as('n'))
        .where('projectId', '=', projectId)
        .where('status', '<>', 'resolved')
        .where('deadline', '<', overdueCutoff)
        .as('overdueIssues'),
    ])
    .executeTakeFirstOrThrow();
  return { ...row, overdueItems: Number(row.overdueItems), overdueIssues: Number(row.overdueIssues) };
}
