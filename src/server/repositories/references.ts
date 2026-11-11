import 'server-only';
import type { Db } from '#src/server/db/client.ts';

export type References = {
  readonly areaId?: string | null;
  readonly planItemId?: string | null;
  readonly issueId?: string | null;
  readonly pullRequestId?: string | null;
  readonly releaseId?: string | null;
  readonly personIds?: readonly string[];
  readonly pullRequestIds?: readonly string[];
  readonly planItemIds?: readonly string[];
  readonly issueIds?: readonly string[];
};

export type ReferenceCheck = {
  readonly area: boolean;
  readonly planItem: boolean;
  readonly issue: boolean;
  readonly pullRequest: boolean;
  readonly release: boolean;
  readonly people: boolean;
  readonly pullRequests: boolean;
  readonly planItems: boolean;
  readonly issues: boolean;
};

/** BR-19: whether each referenced record exists in this project — one query for all of them. */
export async function checkReferences(db: Db, projectId: string, refs: References): Promise<ReferenceCheck> {
  const personIds = refs.personIds ?? [];
  const prIds = refs.pullRequestIds ?? [];
  const planItemIds = refs.planItemIds ?? [];
  const issueIds = refs.issueIds ?? [];
  const row = await db
    .selectNoFrom((eb) => {
      const exists = (
        table: 'areas' | 'planItems' | 'issues' | 'pullRequests' | 'releases',
        id: string | null | undefined,
        alias: keyof ReferenceCheck,
      ) =>
        (id === null || id === undefined
          ? eb.lit(true)
          : eb.exists(eb.selectFrom(table).select('id').where('id', '=', id).where('projectId', '=', projectId))
        ).as(alias);
      return [
        exists('areas', refs.areaId, 'area'),
        exists('planItems', refs.planItemId, 'planItem'),
        exists('issues', refs.issueId, 'issue'),
        exists('pullRequests', refs.pullRequestId, 'pullRequest'),
        exists('releases', refs.releaseId, 'release'),
        (personIds.length === 0
          ? eb.lit(true)
          : eb(
              eb.selectFrom('people').select((s) => s.fn.countAll<string>().as('n')).where('id', 'in', personIds),
              '=',
              String(personIds.length),
            )
        ).as('people'),
        (prIds.length === 0
          ? eb.lit(true)
          : eb(
              eb
                .selectFrom('pullRequests')
                .select((s) => s.fn.countAll<string>().as('n'))
                .where('id', 'in', prIds)
                .where('projectId', '=', projectId),
              '=',
              String(prIds.length),
            )
        ).as('pullRequests'),
        (planItemIds.length === 0
          ? eb.lit(true)
          : eb(
              eb
                .selectFrom('planItems')
                .select((s) => s.fn.countAll<string>().as('n'))
                .where('id', 'in', planItemIds)
                .where('projectId', '=', projectId),
              '=',
              String(planItemIds.length),
            )
        ).as('planItems'),
        (issueIds.length === 0
          ? eb.lit(true)
          : eb(
              eb.selectFrom('issues').select((s) => s.fn.countAll<string>().as('n')).where('id', 'in', issueIds).where('projectId', '=', projectId),
              '=',
              String(issueIds.length),
            )
        ).as('issues'),
      ];
    })
    .executeTakeFirstOrThrow();
  return {
    area: row.area === true,
    planItem: row.planItem === true,
    issue: row.issue === true,
    pullRequest: row.pullRequest === true,
    release: row.release === true,
    people: row.people === true,
    pullRequests: row.pullRequests === true,
    planItems: row.planItems === true,
    issues: row.issues === true,
  };
}
