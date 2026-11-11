import 'server-only';
import { sql } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import type { Db } from '#src/server/db/client.ts';
import type { PrState, ReportKind } from '#src/server/db/types.ts';
import type { IsoDate } from '#src/server/domain/calendar.ts';

/* Writes below do not open transactions: services compose them inside one. */

export type NoteRow = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly updatedAt: string;
  readonly releaseId: string | null;
  readonly releaseVersion: string | null;
  readonly pullRequestId: string | null;
  readonly prOwner: string | null;
  readonly prRepo: string | null;
  readonly prNumber: number | null;
  readonly prTitle: string | null;
  readonly prState: PrState | null;
  readonly links: readonly { readonly label: string; readonly url: string }[];
};

export type NoteFilter = { readonly id?: string; readonly releaseId?: string; readonly pullRequestId?: string };

export async function selectNotes(db: Db, projectId: string, filter: NoteFilter = {}): Promise<readonly NoteRow[]> {
  return await db
    .selectFrom('notes as n')
    .leftJoin('releases as r', 'r.id', 'n.releaseId')
    .leftJoin('pullRequests as pr', 'pr.id', 'n.pullRequestId')
    .select([
      'n.id',
      'n.title',
      'n.body',
      sql<string>`n.updated_at::text`.as('updatedAt'),
      'n.releaseId',
      'r.version as releaseVersion',
      'n.pullRequestId',
      'pr.owner as prOwner',
      'pr.repo as prRepo',
      'pr.number as prNumber',
      'pr.title as prTitle',
      'pr.state as prState',
    ])
    .select((eb) =>
      jsonArrayFrom(
        eb.selectFrom('noteLinks as l').select(['l.label', 'l.url']).whereRef('l.noteId', '=', 'n.id').orderBy('l.position'),
      ).as('links'),
    )
    .where((eb) => {
      const conditions = [eb('n.projectId', '=', projectId)];
      if (filter.id !== undefined) {
        conditions.push(eb('n.id', '=', filter.id));
      }
      if (filter.releaseId !== undefined) {
        conditions.push(eb('n.releaseId', '=', filter.releaseId));
      }
      if (filter.pullRequestId !== undefined) {
        conditions.push(eb('n.pullRequestId', '=', filter.pullRequestId));
      }
      return eb.and(conditions);
    })
    .orderBy('n.updatedAt', 'desc')
    .execute();
}

export type NoteValues = {
  readonly title: string;
  readonly body: string;
  readonly releaseId: string | null;
  readonly pullRequestId: string | null;
};
export type NoteLink = { readonly label: string; readonly url: string };

async function replaceLinks(db: Db, noteId: string, links: readonly NoteLink[]): Promise<void> {
  await db.deleteFrom('noteLinks').where('noteId', '=', noteId).execute();
  if (links.length > 0) {
    await db
      .insertInto('noteLinks')
      .values(links.map((link, position) => ({ noteId, ...link, position })))
      .execute();
  }
}

export async function insertNote(db: Db, projectId: string, values: NoteValues, links: readonly NoteLink[]): Promise<string> {
  const { id } = await db.insertInto('notes').values({ projectId, ...values }).returning('id').executeTakeFirstOrThrow();
  await replaceLinks(db, id, links);
  return id;
}

export async function updateNoteRow(db: Db, projectId: string, id: string, values: NoteValues, links: readonly NoteLink[]): Promise<boolean> {
  const result = await db
    .updateTable('notes')
    .set({ ...values, updatedAt: new Date() })
    .where('id', '=', id)
    .where('projectId', '=', projectId)
    .executeTakeFirst();
  if (result.numUpdatedRows === 0n) {
    return false;
  }
  await replaceLinks(db, id, links);
  return true;
}

export async function deleteNoteRow(db: Db, projectId: string, id: string): Promise<boolean> {
  const result = await db.deleteFrom('notes').where('id', '=', id).where('projectId', '=', projectId).executeTakeFirst();
  return result.numDeletedRows > 0n;
}

/* ------------------------------------------------------------ report notes */

export async function selectReportNote(db: Db, projectId: string, kind: ReportKind, periodStart: IsoDate): Promise<string | undefined> {
  const row = await db
    .selectFrom('reportNotes')
    .select('body')
    .where('projectId', '=', projectId)
    .where('kind', '=', kind)
    .where('periodStart', '=', periodStart)
    .executeTakeFirst();
  return row?.body;
}

export async function upsertReportNote(db: Db, projectId: string, kind: ReportKind, periodStart: IsoDate, body: string): Promise<void> {
  await db
    .insertInto('reportNotes')
    .values({ projectId, kind, periodStart, body })
    .onConflict((oc) => oc.columns(['projectId', 'kind', 'periodStart']).doUpdateSet({ body, updatedAt: new Date() }))
    .execute();
}

export async function deleteReportNote(db: Db, projectId: string, kind: ReportKind, periodStart: IsoDate): Promise<void> {
  await db
    .deleteFrom('reportNotes')
    .where('projectId', '=', projectId)
    .where('kind', '=', kind)
    .where('periodStart', '=', periodStart)
    .execute();
}
