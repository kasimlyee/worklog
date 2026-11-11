import { readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

/** Every page route in src/app (route groups removed; dev previews excluded). */
export function pageRoutes(): readonly string[] {
  const appDir = join(import.meta.dirname, '..', '..', '..', 'src', 'app');
  return readdirSync(appDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith(`${sep}page.tsx`) || file === 'page.tsx')
    .filter((file) => !file.includes('(dev)'))
    .map((file) => {
      const segments = file.split(sep).slice(0, -1).filter((segment) => !/^\(.*\)$/.test(segment));
      return `/${segments.join('/')}`;
    })
    .sort();
}

export type RouteIds = {
  readonly projectId: string;
  readonly itemId: string;
  readonly entryId: string;
  readonly issueId: string;
  readonly releaseId: string;
  readonly noteId: string;
};

/** A route with its dynamic segments filled from seeded data. */
export function fill(route: string, ids: RouteIds): string {
  return route
    .replace('[projectId]', ids.projectId)
    .replace('[itemId]', ids.itemId)
    .replace('[entryId]', ids.entryId)
    .replace('[issueId]', ids.issueId)
    .replace('[releaseId]', ids.releaseId)
    .replace('[noteId]', ids.noteId);
}
