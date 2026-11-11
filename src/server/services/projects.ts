import 'server-only';
import * as z from 'zod';
import { ok } from '#src/lib/result.ts';
import type { Db } from '#src/server/db/client.ts';
import { isUniqueViolation } from '#src/server/db/errors.ts';
import { slugify, uniqueSlug } from '#src/server/domain/slug.ts';
import {
  insertArea, insertPerson, insertProject, selectAreas, selectPeople, selectProject, selectProjects,
  selectSlugsLike, updateAreaRow, updatePersonRow, updateProjectRow, type AreaRow, type PersonRow, type ProjectRow,
} from '#src/server/repositories/projects.ts';
import { invalid, notFound, parseInput, type ServiceResult } from './errors.ts';
import { id, isUuid, optionalText, requiredText } from './fields.ts';

export type Project = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly isArchived: boolean;
};
export type Area = { readonly id: string; readonly name: string; readonly position: number; readonly isArchived: boolean };
export type Person = { readonly id: string; readonly name: string; readonly isArchived: boolean };

const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  isArchived: row.archivedAt !== null,
});
const toArea = (row: AreaRow): Area => ({ id: row.id, name: row.name, position: row.position, isArchived: row.archivedAt !== null });
const toPerson = (row: PersonRow): Person => ({ id: row.id, name: row.name, isArchived: row.archivedAt !== null });

/* ---------------------------------------------------------------- projects */

const projectInput = z.object({
  name: requiredText('Name', 120),
  description: optionalText('Description', 2000),
});

const duplicateProject = invalid({ name: 'A project with this name already exists.' });

export async function listProjects(db: Db, { includeArchived = false } = {}): Promise<readonly Project[]> {
  return (await selectProjects(db, includeArchived)).map(toProject);
}

/** The project, archived or not; `null` for an unknown or malformed id. */
export async function getProject(db: Db, projectId: string): Promise<Project | null> {
  if (!isUuid(projectId)) {
    return null;
  }
  const row = await selectProject(db, projectId);
  return row === undefined ? null : toProject(row);
}

async function freeSlug(db: Db, name: string, ownId?: string): Promise<string> {
  const base = slugify(name);
  const taken = new Set(await selectSlugsLike(db, base));
  if (ownId !== undefined) {
    const own = await selectProject(db, ownId);
    if (own !== undefined) {
      taken.delete(own.slug);
    }
  }
  return uniqueSlug(base, taken);
}

/** BR-05: names are unique. The slug follows the name and is used for export file names. */
export async function createProject(db: Db, input: unknown): Promise<ServiceResult<Project>> {
  const parsed = parseInput(projectInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  try {
    const row = await insertProject(db, { ...parsed.value, slug: await freeSlug(db, parsed.value.name) });
    return ok(toProject(row));
  } catch (error) {
    if (isUniqueViolation(error, 'projects_name_key')) {
      return duplicateProject;
    }
    throw error;
  }
}

export async function updateProject(db: Db, projectId: string, input: unknown): Promise<ServiceResult<Project>> {
  const parsed = parseInput(projectInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  if (!isUuid(projectId)) {
    return notFound;
  }
  try {
    const slug = await freeSlug(db, parsed.value.name, projectId);
    const row = await updateProjectRow(db, projectId, { ...parsed.value, slug });
    return row === undefined ? notFound : ok(toProject(row));
  } catch (error) {
    if (isUniqueViolation(error, 'projects_name_key')) {
      return duplicateProject;
    }
    throw error;
  }
}

/** BR-06: archive, never delete. */
export async function setProjectArchived(db: Db, projectId: string, archived: boolean): Promise<ServiceResult<Project>> {
  if (!isUuid(projectId)) {
    return notFound;
  }
  const row = await updateProjectRow(db, projectId, { archivedAt: archived ? new Date() : null });
  return row === undefined ? notFound : ok(toProject(row));
}

/* ------------------------------------------------------------------- areas */

const areaInput = z.object({ name: requiredText('Name', 60) });
const duplicateArea = invalid({ name: 'This project already has an area with this name.' });

/** BR-07: in the user's order. */
export async function listAreas(db: Db, projectId: string, { includeArchived = false } = {}): Promise<readonly Area[]> {
  return (await selectAreas(db, projectId, includeArchived)).map(toArea);
}

export async function createArea(db: Db, projectId: string, input: unknown): Promise<ServiceResult<Area>> {
  const parsed = parseInput(areaInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  try {
    return ok(toArea(await insertArea(db, projectId, parsed.value.name)));
  } catch (error) {
    if (isUniqueViolation(error, 'areas_project_id_name_key')) {
      return duplicateArea;
    }
    throw error;
  }
}

export async function renameArea(db: Db, projectId: string, areaId: string, input: unknown): Promise<ServiceResult<Area>> {
  const parsed = parseInput(areaInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  if (!isUuid(areaId)) {
    return notFound;
  }
  try {
    const row = await updateAreaRow(db, projectId, areaId, { name: parsed.value.name });
    return row === undefined ? notFound : ok(toArea(row));
  } catch (error) {
    if (isUniqueViolation(error, 'areas_project_id_name_key')) {
      return duplicateArea;
    }
    throw error;
  }
}

/** BR-06 */
export async function setAreaArchived(db: Db, projectId: string, areaId: string, archived: boolean): Promise<ServiceResult<Area>> {
  if (!isUuid(areaId)) {
    return notFound;
  }
  const row = await updateAreaRow(db, projectId, areaId, { archivedAt: archived ? new Date() : null });
  return row === undefined ? notFound : ok(toArea(row));
}

const reorderInput = z.object({ areaIds: z.array(id).min(1).max(100) });

/**
 * BR-07: `areaIds` is the new order of the project's active areas. Archived areas keep
 * their relative order after them. One transaction; the unique position constraint is deferred.
 */
export async function reorderAreas(db: Db, projectId: string, input: unknown): Promise<ServiceResult<readonly Area[]>> {
  const parsed = parseInput(reorderInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  const requested = parsed.value.areaIds;
  return await db.transaction().execute(async (trx) => {
    const all = await selectAreas(trx, projectId, true);
    const active = all.filter((area) => area.archivedAt === null);
    const activeIds = new Set(active.map((area) => area.id));
    if (requested.length !== activeIds.size || new Set(requested).size !== requested.length || !requested.every((areaId) => activeIds.has(areaId))) {
      return invalid({ areaIds: 'The list of areas has changed. Reload and try again.' });
    }
    const order = [...requested, ...all.filter((area) => area.archivedAt !== null).map((area) => area.id)];
    for (const [position, areaId] of order.entries()) {
      await updateAreaRow(trx, projectId, areaId, { position });
    }
    return ok((await selectAreas(trx, projectId, false)).map(toArea));
  });
}

/* ------------------------------------------------------------------ people */

const personInput = z.object({ name: requiredText('Name', 80) });
const duplicatePerson = invalid({ name: 'A person with this name already exists.' });

export async function listPeople(db: Db, { includeArchived = false } = {}): Promise<readonly Person[]> {
  return (await selectPeople(db, includeArchived)).map(toPerson);
}

export async function createPerson(db: Db, input: unknown): Promise<ServiceResult<Person>> {
  const parsed = parseInput(personInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  try {
    return ok(toPerson(await insertPerson(db, parsed.value.name)));
  } catch (error) {
    if (isUniqueViolation(error, 'people_name_key')) {
      return duplicatePerson;
    }
    throw error;
  }
}

export async function renamePerson(db: Db, personId: string, input: unknown): Promise<ServiceResult<Person>> {
  const parsed = parseInput(personInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  if (!isUuid(personId)) {
    return notFound;
  }
  try {
    const row = await updatePersonRow(db, personId, { name: parsed.value.name });
    return row === undefined ? notFound : ok(toPerson(row));
  } catch (error) {
    if (isUniqueViolation(error, 'people_name_key')) {
      return duplicatePerson;
    }
    throw error;
  }
}

/** BR-06 */
export async function setPersonArchived(db: Db, personId: string, archived: boolean): Promise<ServiceResult<Person>> {
  if (!isUuid(personId)) {
    return notFound;
  }
  const row = await updatePersonRow(db, personId, { archivedAt: archived ? new Date() : null });
  return row === undefined ? notFound : ok(toPerson(row));
}
