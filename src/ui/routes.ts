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

export const projectsHref: Route = '/projects';
export const peopleHref: Route = '/people';
