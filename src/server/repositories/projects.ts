import 'server-only';
import type { Selectable } from 'kysely';
import type { Db } from '#src/server/db/client.ts';
import type { AreasTable, PeopleTable, ProjectsTable } from '#src/server/db/types.ts';

export type ProjectRow = Selectable<ProjectsTable>;
export type AreaRow = Selectable<AreasTable>;
export type PersonRow = Selectable<PeopleTable>;

/* ---------------------------------------------------------------- projects */

export async function selectProjects(db: Db, includeArchived: boolean): Promise<readonly ProjectRow[]> {
  return await db
    .selectFrom('projects')
    .selectAll()
    .$if(!includeArchived, (q) => q.where('archivedAt', 'is', null))
    .orderBy('name')
    .execute();
}

export async function selectProject(db: Db, id: string): Promise<ProjectRow | undefined> {
  return await db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function selectSlugsLike(db: Db, base: string): Promise<ReadonlySet<string>> {
  const rows = await db
    .selectFrom('projects')
    .select('slug')
    .where((eb) => eb.or([eb('slug', '=', base), eb('slug', 'like', `${base}-%`)]))
    .execute();
  return new Set(rows.map((row) => row.slug));
}

export async function insertProject(
  db: Db,
  values: { readonly name: string; readonly slug: string; readonly description: string },
): Promise<ProjectRow> {
  return await db.insertInto('projects').values(values).returningAll().executeTakeFirstOrThrow();
}

export async function updateProjectRow(
  db: Db,
  id: string,
  values: Partial<{ name: string; slug: string; description: string; archivedAt: Date | null }>,
): Promise<ProjectRow | undefined> {
  return await db
    .updateTable('projects')
    .set({ ...values, updatedAt: new Date() })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();
}

/* ------------------------------------------------------------------- areas */

export async function selectAreas(db: Db, projectId: string, includeArchived: boolean): Promise<readonly AreaRow[]> {
  return await db
    .selectFrom('areas')
    .selectAll()
    .where('projectId', '=', projectId)
    .$if(!includeArchived, (q) => q.where('archivedAt', 'is', null))
    .orderBy('position')
    .execute();
}

export async function insertArea(db: Db, projectId: string, name: string): Promise<AreaRow> {
  return await db
    .insertInto('areas')
    .values((eb) => ({
      projectId,
      name,
      position: eb
        .selectFrom('areas')
        .select(eb.fn.coalesce(eb(eb.fn.max('position'), '+', 1), eb.lit(0)).as('next'))
        .where('projectId', '=', projectId),
    }))
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateAreaRow(
  db: Db,
  projectId: string,
  id: string,
  values: Partial<{ name: string; archivedAt: Date | null; position: number }>,
): Promise<AreaRow | undefined> {
  return await db
    .updateTable('areas')
    .set(values)
    .where('id', '=', id)
    .where('projectId', '=', projectId)
    .returningAll()
    .executeTakeFirst();
}

/* ------------------------------------------------------------------ people */

export async function selectPeople(db: Db, includeArchived: boolean): Promise<readonly PersonRow[]> {
  return await db
    .selectFrom('people')
    .selectAll()
    .$if(!includeArchived, (q) => q.where('archivedAt', 'is', null))
    .orderBy('name')
    .execute();
}

export async function insertPerson(db: Db, name: string): Promise<PersonRow> {
  return await db.insertInto('people').values({ name }).returningAll().executeTakeFirstOrThrow();
}

export async function updatePersonRow(
  db: Db,
  id: string,
  values: Partial<{ name: string; archivedAt: Date | null }>,
): Promise<PersonRow | undefined> {
  return await db.updateTable('people').set(values).where('id', '=', id).returningAll().executeTakeFirst();
}

export async function countExistingPeople(db: Db, ids: readonly string[]): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }
  const row = await db
    .selectFrom('people')
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .where('id', 'in', ids)
    .executeTakeFirstOrThrow();
  return Number(row.count);
}
