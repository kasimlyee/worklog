import type { Route } from 'next';

/*
 * Every in-app URL is built here. typedRoutes cannot follow ids known only at run time,
 * so this is the one place a string becomes a Route (each path below exists in src/app).
 */

export type ProjectSection = '' | 'plans' | 'log' | 'issues' | 'releases' | 'notes' | 'reports' | 'settings' | 'pull-requests';

function route(path: string): Route {
  return path as Route; // see the note above
}

export function projectHref(projectId: string, section: ProjectSection = '', query = ''): Route {
  const base = `/projects/${encodeURIComponent(projectId)}${section === '' ? '' : `/${section}`}`;
  return route(query === '' ? base : `${base}?${query}`);
}

export function projectItemHref(
  projectId: string,
  section: 'plans/items' | 'log' | 'issues' | 'releases' | 'notes',
  itemId: string,
  suffix: '' | 'edit' = '',
): Route {
  return route(`${projectHref(projectId, '')}/${section}/${encodeURIComponent(itemId)}${suffix === '' ? '' : `/${suffix}`}`);
}

export function newItemHref(projectId: string, section: 'issues' | 'releases' | 'notes'): Route {
  return route(`${projectHref(projectId, '')}/${section}/new`);
}

export const projectsHref: Route = route('/projects');
export const peopleHref: Route = route('/people');
