import 'server-only';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { appDatabase, appToday } from '#src/server/app-context.ts';
import { listIssues } from '#src/server/services/issues.ts';
import { listOpenPlanItems } from '#src/server/services/plans.ts';
import { getProject, listAreas, listPeople, type Project } from '#src/server/services/projects.ts';
import { listPullRequests } from '#src/server/services/pull-requests.ts';
import { listReleases } from '#src/server/services/releases.ts';
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

/** Option lists for the project's forms (quick log, plan items, issues…). */
export const loadPickers = cache(async (projectId: string): Promise<Pickers> => {
  const db = appDatabase();
  const today = appToday();
  const [areas, people, planItems, issues, pullRequests, releases] = await Promise.all([
    listAreas(db, projectId),
    listPeople(db),
    listOpenPlanItems(db, projectId, today),
    listIssues(db, projectId, today, { openOnly: true }),
    listPullRequests(db, projectId),
    listReleases(db, projectId),
  ]);
  return toPickers({ areas, people, planItems, issues, pullRequests, releases });
});

/** A single search param as a string ('' when missing or repeated). */
export function param(searchParams: Readonly<Record<string, string | string[] | undefined>>, name: string): string {
  const value = searchParams[name];
  return typeof value === 'string' ? value : '';
}
