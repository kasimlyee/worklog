import 'server-only';
import type { Db } from '#src/server/db/client.ts';
import type { IsoDate } from '#src/server/domain/calendar.ts';

export type ProjectOverdueRow = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly overdueItems: number;
  readonly overdueIssues: number;
};

/** Active projects with their overdue plan items and issues, in one query (BR-13, BR-31). */
export async function selectProjectsWithOverdue(db: Db, cutoff: IsoDate): Promise<readonly ProjectOverdueRow[]> {
  const rows = await db
    .selectFrom('projects as p')
    .select(['p.id', 'p.name', 'p.slug', 'p.description'])
    .select((eb) => [
      eb
        .selectFrom('planItems as pi')
        .select((s) => s.fn.countAll<string>().as('n'))
        .whereRef('pi.projectId', '=', 'p.id')
        .where('pi.status', '<>', 'done')
        .where('pi.dueDate', '<', cutoff)
        .as('overdueItems'),
      eb
        .selectFrom('issues as i')
        .select((s) => s.fn.countAll<string>().as('n'))
        .whereRef('i.projectId', '=', 'p.id')
        .where('i.status', '<>', 'resolved')
        .where('i.deadline', '<', cutoff)
        .as('overdueIssues'),
    ])
    .where('p.archivedAt', 'is', null)
    .orderBy('p.name')
    .execute();
  return rows.map((row) => ({ ...row, overdueItems: Number(row.overdueItems), overdueIssues: Number(row.overdueIssues) }));
}
