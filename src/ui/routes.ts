import type { Route } from 'next';

/** Every in-app URL is built here, so links and redirects agree on the paths in src/app. */

export type ProjectSection = '' | 'plans' | 'log' | 'issues' | 'releases' | 'notes' | 'reports' | 'settings' | 'pull-requests';

export function projectHref(projectId: string, section: ProjectSection = '', query = ''): Route {
  const base = `/projects/${encodeURIComponent(projectId)}${section === '' ? '' : `/${section}`}`;
  return query === '' ? base : `${base}?${query}`;
}

export function projectItemHref(
  projectId: string,
  section: 'plans/items' | 'log' | 'issues' | 'releases' | 'notes',
  itemId: string,
  suffix: '' | 'edit' = '',
): Route {
  return `${projectHref(projectId)}/${section}/${encodeURIComponent(itemId)}${suffix === '' ? '' : `/${suffix}`}`;
}

export function newItemHref(projectId: string, section: 'issues' | 'releases' | 'notes'): Route {
  return `${projectHref(projectId)}/${section}/new`;
}

/** BR-47: a weekly or monthly plan as a file (a GET route handler, so a plain link). */
export function planExportHref(projectId: string, kind: 'weekly' | 'monthly', start: string, format: 'pdf' | 'md'): string {
  return `${projectHref(projectId)}/plans/export?kind=${kind}&start=${start}&format=${format}`;
}

export const projectsHref: Route = '/projects';
export const peopleHref: Route = '/people';
