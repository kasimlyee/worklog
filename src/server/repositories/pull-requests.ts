import 'server-only';
import type { Selectable } from 'kysely';
import type { Db } from '#src/server/db/client.ts';
import type { PrState, PullRequestsTable } from '#src/server/db/types.ts';
import type { PrRef } from '#src/server/domain/pull-request-url.ts';

export type PullRequestRow = Selectable<PullRequestsTable>;

export async function selectPullRequestByRef(db: Db, projectId: string, ref: PrRef): Promise<PullRequestRow | undefined> {
  // Owner and repo names are case-insensitive on GitHub.
  return await db
    .selectFrom('pullRequests')
    .selectAll()
    .where('projectId', '=', projectId)
    .where((eb) => eb(eb.fn('lower', ['owner']), '=', ref.owner.toLowerCase()))
    .where((eb) => eb(eb.fn('lower', ['repo']), '=', ref.repo.toLowerCase()))
    .where('number', '=', ref.number)
    .executeTakeFirst();
}

export async function selectPullRequest(db: Db, projectId: string, id: string): Promise<PullRequestRow | undefined> {
  return await db.selectFrom('pullRequests').selectAll().where('id', '=', id).where('projectId', '=', projectId).executeTakeFirst();
}

export async function selectPullRequests(db: Db, projectId: string): Promise<readonly PullRequestRow[]> {
  return await db
    .selectFrom('pullRequests')
    .selectAll()
    .where('projectId', '=', projectId)
    .orderBy('repo')
    .orderBy('number', 'desc')
    .execute();
}

export async function insertPullRequest(
  db: Db,
  values: PrRef & { readonly projectId: string; readonly title: string; readonly state: PrState; readonly fetchedAt: Date },
): Promise<PullRequestRow | undefined> {
  return await db
    .insertInto('pullRequests')
    .values(values)
    .onConflict((oc) => oc.columns(['projectId', 'owner', 'repo', 'number']).doNothing())
    .returningAll()
    .executeTakeFirst();
}

export async function updatePullRequestRow(
  db: Db,
  projectId: string,
  id: string,
  values: { readonly title: string; readonly state: PrState; readonly fetchedAt: Date },
): Promise<PullRequestRow | undefined> {
  return await db
    .updateTable('pullRequests')
    .set(values)
    .where('id', '=', id)
    .where('projectId', '=', projectId)
    .returningAll()
    .executeTakeFirst();
}

export async function deletePullRequestRow(db: Db, projectId: string, id: string): Promise<boolean> {
  const result = await db.deleteFrom('pullRequests').where('id', '=', id).where('projectId', '=', projectId).executeTakeFirst();
  return result.numDeletedRows > 0n;
}
