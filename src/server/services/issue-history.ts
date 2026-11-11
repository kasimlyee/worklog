import 'server-only';
import type { Db } from '#src/server/db/client.ts';
import type { IsoDate } from '#src/server/domain/calendar.ts';
import { selectEntries } from '#src/server/repositories/entries.ts';
import { selectPlanItems } from '#src/server/repositories/plans.ts';
import { toEntry, type Entry } from './entries.ts';
import { isUuid } from './fields.ts';
import { toPlanItem, type PlanItem } from './plans.ts';

export type IssueHistory = { readonly planItems: readonly PlanItem[]; readonly entries: readonly Entry[] };

/** BR-40: the plan items and log entries that worked on an issue — two queries, oldest first. */
export async function getIssueHistory(db: Db, projectId: string, issueId: string, today: IsoDate): Promise<IssueHistory> {
  if (!isUuid(issueId)) {
    return { planItems: [], entries: [] };
  }
  const [items, entries] = await Promise.all([
    selectPlanItems(db, projectId, { issueId }),
    selectEntries(db, projectId, { issueId, order: 'oldest' }),
  ]);
  return { planItems: items.map((row) => toPlanItem(row, today)), entries: entries.map(toEntry) };
}
