import 'server-only';
import type { Db } from '#src/server/db/client.ts';
import type { IsoDate } from '#src/server/domain/calendar.ts';
import { overdueCutoff } from '#src/server/domain/deadlines.ts';
import { selectProjectChrome, type ProjectChromeRow } from '#src/server/repositories/project-chrome.ts';

export type PickerOptions = Omit<ProjectChromeRow, 'overdueItems' | 'overdueIssues'>;
export type ProjectChrome = { readonly options: PickerOptions; readonly overdueCount: number };

/** Form options and the BR-13 overdue count for one project, in one query. Archived areas and people are left out (BR-06). */
export async function loadProjectChrome(db: Db, projectId: string, today: IsoDate): Promise<ProjectChrome> {
  const { overdueItems, overdueIssues, ...options } = await selectProjectChrome(db, projectId, overdueCutoff(today), 200);
  return { options, overdueCount: overdueItems + overdueIssues };
}
