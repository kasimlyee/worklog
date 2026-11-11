import {
  aPerson, aPlan, aPlanItem, aProject, aPullRequest, aRelease, anArea, anEntry, anIssue, withPeople,
} from '#tests/fixtures/builders.ts';
import { appToday, previousWorkingDay, weekStart } from './dates.ts';
import { e2eDb } from './database.ts';
import type { RouteIds } from './routes.ts';

/**
 * One project with something in every table, every text field set to `text(field)`.
 * Used by the security (XSS) and accessibility suites.
 */
export async function seedEverything(text: (field: string) => string = (field) => field): Promise<RouteIds> {
  const db = e2eDb();
  const today = appToday();
  const project = await aProject(db, { name: text('Project name'), slug: 'atlas', description: text('Project description') });
  const area = await anArea(db, project.id, { name: text('Area') });
  const ali = await aPerson(db, { name: text('Person') });
  const pr = await aPullRequest(db, project.id, { repo: 'app', number: 12, title: text('PR title'), state: 'merged' });
  const week = await aPlan(db, project.id, { horizon: 'week', periodStart: weekStart(today) });
  const overdue = await aPlan(db, project.id, { horizon: 'day', periodStart: previousWorkingDay(today) });
  const item = await aPlanItem(db, overdue, { title: text('Plan item'), dueDate: previousWorkingDay(today), areaId: area.id });
  await aPlanItem(db, week, { title: text('Week item'), dueDate: weekStart(today), status: 'done', completedOn: today });
  await withPeople(db, 'planItemAssignees', item.id, [ali.id]);
  const issue = await anIssue(db, project.id, {
    title: text('Issue'),
    externalUrl: 'https://jira.example.com/browse/APP-1',
    assignedOn: previousWorkingDay(previousWorkingDay(today)),
    deadline: previousWorkingDay(today),
    areaId: area.id,
  });
  await withPeople(db, 'issueAssignees', issue.id, [ali.id]);
  const entry = await anEntry(db, project.id, {
    workDate: today,
    description: text('Entry'),
    areaId: area.id,
    pullRequestId: pr.id,
    planItemId: item.id,
    issueId: issue.id,
  });
  await withPeople(db, 'entryPeople', entry.id, [ali.id]);
  const release = await aRelease(db, project.id, { version: text('Version').slice(0, 50), status: 'released', releasedOn: today, notes: text('Release notes') });
  await db.insertInto('releasePullRequests').values({ projectId: project.id, releaseId: release.id, pullRequestId: pr.id }).execute();
  const note = await db
    .insertInto('notes')
    .values({ projectId: project.id, title: text('Note'), body: text('Note body'), releaseId: release.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  await db.insertInto('noteLinks').values({ noteId: note.id, label: text('Link label'), url: 'https://docs.example.com' }).execute();
  await db.insertInto('reportNotes').values({ projectId: project.id, kind: 'weekly', periodStart: weekStart(today), body: text('Report note') }).execute();
  return { projectId: project.id, itemId: item.id, entryId: entry.id, issueId: issue.id, releaseId: release.id, noteId: note.id };
}
