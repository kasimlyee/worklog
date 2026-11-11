import type { Insertable, Selectable } from 'kysely';
import type { Db } from '#src/server/db/client.ts';
import type {
  AreasTable, EntriesTable, IssuesTable, PeopleTable, PlanItemsTable, PlansTable, ProjectsTable,
  PullRequestsTable, ReleasesTable,
} from '#src/server/db/types.ts';

/*
 * Test data builders (docs/03 §3.1): sensible defaults, explicit overrides.
 * They write straight to the database so tests can arrange any state, including
 * states the services would refuse.
 */

let counter = 0;
function next(): number {
  counter += 1;
  return counter;
}

export async function aProject(db: Db, overrides: Partial<Insertable<ProjectsTable>> = {}): Promise<Selectable<ProjectsTable>> {
  const n = next();
  return await db
    .insertInto('projects')
    .values({ name: `Project ${String(n)}`, slug: `project-${String(n)}`, ...overrides })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function anArea(
  db: Db,
  projectId: string,
  overrides: Partial<Insertable<AreasTable>> = {},
): Promise<Selectable<AreasTable>> {
  const n = next();
  return await db
    .insertInto('areas')
    .values({ projectId, name: `Area ${String(n)}`, position: n, ...overrides })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function aPerson(db: Db, overrides: Partial<Insertable<PeopleTable>> = {}): Promise<Selectable<PeopleTable>> {
  return await db
    .insertInto('people')
    .values({ name: `Person ${String(next())}`, ...overrides })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function aPullRequest(
  db: Db,
  projectId: string,
  overrides: Partial<Insertable<PullRequestsTable>> = {},
): Promise<Selectable<PullRequestsTable>> {
  const n = next();
  return await db
    .insertInto('pullRequests')
    .values({
      projectId,
      owner: 'acme',
      repo: 'app',
      number: n,
      title: `PR ${String(n)}`,
      state: 'open',
      fetchedAt: new Date('2026-11-01T08:00:00Z'),
      ...overrides,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function anIssue(
  db: Db,
  projectId: string,
  overrides: Partial<Insertable<IssuesTable>> = {},
): Promise<Selectable<IssuesTable>> {
  return await db
    .insertInto('issues')
    .values({
      projectId,
      title: `Issue ${String(next())}`,
      assignedOn: '2026-11-02',
      deadline: '2026-11-13',
      ...overrides,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function aPlan(
  db: Db,
  projectId: string,
  overrides: Partial<Insertable<PlansTable>> = {},
): Promise<Selectable<PlansTable>> {
  return await db
    .insertInto('plans')
    .values({ projectId, horizon: 'week', periodStart: '2026-11-09', ...overrides })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function aPlanItem(
  db: Db,
  plan: Pick<Selectable<PlansTable>, 'id' | 'projectId' | 'periodStart'>,
  overrides: Partial<Insertable<PlanItemsTable>> = {},
): Promise<Selectable<PlanItemsTable>> {
  return await db
    .insertInto('planItems')
    .values({
      projectId: plan.projectId,
      planId: plan.id,
      title: `Item ${String(next())}`,
      dueDate: plan.periodStart,
      ...overrides,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function anEntry(
  db: Db,
  projectId: string,
  overrides: Partial<Insertable<EntriesTable>> = {},
): Promise<Selectable<EntriesTable>> {
  return await db
    .insertInto('entries')
    .values({ projectId, workDate: '2026-11-10', description: `Work ${String(next())}`, ...overrides })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function aRelease(
  db: Db,
  projectId: string,
  overrides: Partial<Insertable<ReleasesTable>> = {},
): Promise<Selectable<ReleasesTable>> {
  return await db
    .insertInto('releases')
    .values({ projectId, version: `1.${String(next())}.0`, ...overrides })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function withPeople(
  db: Db,
  table: 'entryPeople' | 'issueAssignees' | 'planItemAssignees',
  ownerId: string,
  personIds: readonly string[],
): Promise<void> {
  if (personIds.length === 0) {
    return;
  }
  switch (table) {
    case 'entryPeople':
      await db.insertInto('entryPeople').values(personIds.map((personId) => ({ entryId: ownerId, personId }))).execute();
      return;
    case 'issueAssignees':
      await db.insertInto('issueAssignees').values(personIds.map((personId) => ({ issueId: ownerId, personId }))).execute();
      return;
    case 'planItemAssignees':
      await db
        .insertInto('planItemAssignees')
        .values(personIds.map((personId) => ({ planItemId: ownerId, personId })))
        .execute();
      return;
    default:
      table satisfies never;
  }
}
