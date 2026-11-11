import 'server-only';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { appDatabase, appToday } from '#src/server/app-context.ts';
import { loadProjectChrome, type ProjectChrome } from '#src/server/services/project-chrome.ts';
import { getProject, type Project } from '#src/server/services/projects.ts';
import { toPickers } from '#src/server/mappers/view-models.ts';
import type { Pickers } from '#src/ui/view-models/common.ts';

/*
 * Page-level helpers: the project-ownership check and data shared by a layout and its page.
 * `cache` makes each run once per request.
 */

/** The project in the URL, or the 404 page. */
export const requireProject = cache(async (projectId: string): Promise<Project> => {
  const project = await getProject(appDatabase(), projectId);
  if (project === null) {
    notFound();
  }
  return project;
});

/** Form options and the overdue count of a project: one query, shared by layout and page. */
export const loadChrome = cache(async (projectId: string): Promise<ProjectChrome> => await loadProjectChrome(appDatabase(), projectId, appToday()));

/** Option lists for the project's forms (quick log, plan items, issues…). */
export async function loadPickers(projectId: string): Promise<Pickers> {
  return toPickers((await loadChrome(projectId)).options);
}

/** A single search param as a string ('' when missing or repeated). */
export function param(searchParams: Readonly<Record<string, string | string[] | undefined>>, name: string): string {
  const value = searchParams[name];
  return typeof value === 'string' ? value : '';
}
