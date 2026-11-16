import 'server-only';
import { sql } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import type { Db } from '#src/server/db/client.ts';
import type { IssuePriority, PlanItemStatus } from '#src/server/db/types.ts';
import type { IsoDate } from '#src/server/domain/calendar.ts';
import type { NamedRef } from './entries.ts';

/* BR-42 and BR-43: views across every active project. Each function is ONE query. */

type ProjectRef = { readonly projectId: string; readonly projectName: string };

export type OverviewPlanItemRow = ProjectRef & {
  readonly id: string;
  readonly title: string;
  readonly status: PlanItemStatus;
  readonly dueDate: IsoDate;
  readonly assignees: readonly NamedRef[];
};

export type OverviewIssueRow = ProjectRef & {
  readonly id: string;
  readonly title: string;
  readonly priority: IssuePriority;
  readonly deadline: IsoDate;
  readonly assignees: readonly NamedRef[];
};

export type DoneRow = ProjectRef & {
  readonly kind: 'plan_item' | 'issue';
  readonly id: string;
  readonly title: string;
  readonly doneOn: IsoDate;
};

export type TodayProgressRow = { readonly projectId: string; readonly done: number; readonly total: number };

/** Unfinished plan items due on or before `dueOnOrBefore`, in active projects. */
export async function selectOpenPlanItemsAcrossProjects(db: Db, dueOnOrBefore: IsoDate): Promise<readonly OverviewPlanItemRow[]> {
  return await db
    .selectFrom('planItems as pi')
    .innerJoin('projects as p', 'p.id', 'pi.projectId')
    .select(['pi.id', 'pi.title', 'pi.status', 'pi.dueDate', 'p.id as projectId', 'p.name as projectName'])
    .select((eb) =>
      jsonArrayFrom(
        eb
          .selectFrom('planItemAssignees as pa')
          .innerJoin('people as pe', 'pe.id', 'pa.personId')
          .select(['pe.id', 'pe.name'])
          .whereRef('pa.planItemId', '=', 'pi.id')
          .orderBy('pe.name'),
      ).as('assignees'),
    )
    .where('p.archivedAt', 'is', null)
    .where('pi.status', '<>', 'done')
    .where('pi.dueDate', '<=', dueOnOrBefore)
    .orderBy('pi.dueDate')
    .orderBy('p.name')
    .execute();
}

/** Unresolved issues with a deadline on or before `deadlineOnOrBefore`, or marked urgent (BR-37), in active projects. */
export async function selectOpenIssuesAcrossProjects(db: Db, deadlineOnOrBefore: IsoDate): Promise<readonly OverviewIssueRow[]> {
  return await db
    .selectFrom('issues as i')
    .innerJoin('projects as p', 'p.id', 'i.projectId')
    .select(['i.id', 'i.title', 'i.priority', 'i.deadline', 'p.id as projectId', 'p.name as projectName'])
    .select((eb) =>
      jsonArrayFrom(
        eb
          .selectFrom('issueAssignees as ia')
          .innerJoin('people as pe', 'pe.id', 'ia.personId')
          .select(['pe.id', 'pe.name'])
          .whereRef('ia.issueId', '=', 'i.id')
          .orderBy('pe.name'),
      ).as('assignees'),
    )
    .where('p.archivedAt', 'is', null)
    .where('i.status', '<>', 'resolved')
    .where((eb) => eb.or([eb('i.deadline', '<=', deadlineOnOrBefore), eb('i.priority', '=', 'urgent')]))
    .orderBy('i.deadline')
    .orderBy('p.name')
    .execute();
}

/** Plan items completed and issues resolved since `since`, newest first, in active projects. */
export async function selectRecentlyDone(db: Db, since: IsoDate, limit: number): Promise<readonly DoneRow[]> {
  const rows = await db
    .selectFrom((eb) =>
      eb
        .selectFrom('planItems as pi')
        .innerJoin('projects as p', 'p.id', 'pi.projectId')
        .select([
          sql<DoneRow['kind']>`'plan_item'`.as('kind'),
          'pi.id',
          'pi.title',
          sql<IsoDate>`pi.completed_on`.as('doneOn'),
          'p.id as projectId',
          'p.name as projectName',
        ])
        .where('p.archivedAt', 'is', null)
        .where('pi.completedOn', '>=', since)
        .unionAll(
          eb
            .selectFrom('issues as i')
            .innerJoin('projects as p', 'p.id', 'i.projectId')
            .select([
              sql<DoneRow['kind']>`'issue'`.as('kind'),
              'i.id',
              'i.title',
              sql<IsoDate>`i.resolved_on`.as('doneOn'),
              'p.id as projectId',
              'p.name as projectName',
            ])
            .where('p.archivedAt', 'is', null)
            .where('i.resolvedOn', '>=', since),
        )
        .as('done'),
    )
    .selectAll()
    .orderBy('doneOn', 'desc')
    .orderBy('title')
    .limit(limit)
    .execute();
  return rows;
}

/** How much of today's day plan is done, per project that has one. */
export async function selectTodayProgress(db: Db, today: IsoDate): Promise<readonly TodayProgressRow[]> {
  const rows = await db
    .selectFrom('planItems as pi')
    .innerJoin('plans as pl', 'pl.id', 'pi.planId')
    .select((eb) => [
      'pi.projectId',
      eb.fn.countAll<string>().as('total'),
      eb.fn.count<string>('pi.id').filterWhere('pi.status', '=', 'done').as('done'),
    ])
    .where('pl.horizon', '=', 'day')
    .where('pl.periodStart', '=', today)
    .groupBy('pi.projectId')
    .execute();
  return rows.map((row) => ({ projectId: row.projectId, done: Number(row.done), total: Number(row.total) }));
}

export type WorkloadRow = {
  readonly id: string;
  readonly name: string;
  readonly openItems: number;
  readonly overdueItems: number;
  readonly blockedItems: number;
  readonly openIssues: number;
  readonly overdueIssues: number;
  readonly doneRecently: number;
  readonly projects: readonly string[];
};

/** BR-43: each active person's assignments across active projects, in ONE query. */
export async function selectWorkload(db: Db, overdueCutoff: IsoDate, doneSince: IsoDate): Promise<readonly WorkloadRow[]> {
  const rows = await db
    .selectFrom('people as pe')
    .select(['pe.id', 'pe.name'])
    .select((eb) => {
      const items = () =>
        eb
          .selectFrom('planItemAssignees as pa')
          .innerJoin('planItems as pi', 'pi.id', 'pa.planItemId')
          .innerJoin('projects as p', 'p.id', 'pi.projectId')
          .whereRef('pa.personId', '=', 'pe.id')
          .where('p.archivedAt', 'is', null);
      const issues = () =>
        eb
          .selectFrom('issueAssignees as ia')
          .innerJoin('issues as i', 'i.id', 'ia.issueId')
          .innerJoin('projects as p', 'p.id', 'i.projectId')
          .whereRef('ia.personId', '=', 'pe.id')
          .where('p.archivedAt', 'is', null);
      const count = (name: string) => eb.fn.countAll<string>().as(name);
      return [
        items().select(count('n')).where('pi.status', '<>', 'done').as('openItems'),
        items().select(count('n')).where('pi.status', '<>', 'done').where('pi.dueDate', '<', overdueCutoff).as('overdueItems'),
        items().select(count('n')).where('pi.status', '=', 'blocked').as('blockedItems'),
        issues().select(count('n')).where('i.status', '<>', 'resolved').as('openIssues'),
        issues().select(count('n')).where('i.status', '<>', 'resolved').where('i.deadline', '<', overdueCutoff).as('overdueIssues'),
        eb(
          items().select(count('n')).where('pi.completedOn', '>=', doneSince),
          '+',
          issues().select(count('n')).where('i.resolvedOn', '>=', doneSince),
        ).as('doneRecently'),
        sql<readonly string[] | null>`(
          SELECT array_agg(DISTINCT name ORDER BY name) FROM (
            SELECT p.name FROM plan_item_assignees pa
              JOIN plan_items pi ON pi.id = pa.plan_item_id JOIN projects p ON p.id = pi.project_id
              WHERE pa.person_id = pe.id AND p.archived_at IS NULL AND pi.status <> 'done'
            UNION
            SELECT p.name FROM issue_assignees ia
              JOIN issues i ON i.id = ia.issue_id JOIN projects p ON p.id = i.project_id
              WHERE ia.person_id = pe.id AND p.archived_at IS NULL AND i.status <> 'resolved'
          ) open_work
        )`.as('projects'),
      ];
    })
    .where('pe.archivedAt', 'is', null)
    .orderBy('pe.name')
    .execute();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    openItems: Number(row.openItems),
    overdueItems: Number(row.overdueItems),
    blockedItems: Number(row.blockedItems),
    openIssues: Number(row.openIssues),
    overdueIssues: Number(row.overdueIssues),
    doneRecently: Number(row.doneRecently),
    projects: row.projects ?? [],
  }));
}
