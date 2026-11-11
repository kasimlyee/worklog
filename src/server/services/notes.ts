import 'server-only';
import * as z from 'zod';
import { ok } from '#src/lib/result.ts';
import type { Db } from '#src/server/db/client.ts';
import { deleteNoteRow, insertNote, selectNotes, updateNoteRow, type NoteRow } from '#src/server/repositories/notes.ts';
import { invalid, notFound, parseInput, type ServiceResult } from './errors.ts';
import { isUuid, optionalId, optionalText, requiredText, webUrl } from './fields.ts';
import { renderMarkdown } from './markdown.ts';
import { toPullRequest, type PullRequest } from './pull-requests.ts';
import { referenceErrors } from './references.ts';

export type Note = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /** BR-33: safe HTML, raw HTML in the source shown as text. */
  readonly bodyHtml: string;
  readonly updatedAt: string;
  readonly release: { readonly id: string; readonly version: string } | null;
  readonly pullRequest: PullRequest | null;
  readonly links: readonly { readonly label: string; readonly url: string }[];
};

function toNote(row: NoteRow): Note {
  const { prOwner, prRepo, prNumber, prTitle, prState } = row;
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    bodyHtml: renderMarkdown(row.body),
    updatedAt: row.updatedAt,
    release: row.releaseId !== null && row.releaseVersion !== null ? { id: row.releaseId, version: row.releaseVersion } : null,
    pullRequest:
      row.pullRequestId !== null && prOwner !== null && prRepo !== null && prNumber !== null && prTitle !== null && prState !== null
        ? toPullRequest({ id: row.pullRequestId, owner: prOwner, repo: prRepo, number: prNumber, title: prTitle, state: prState })
        : null,
    links: row.links,
  };
}

export async function listNotes(db: Db, projectId: string, filter: { readonly releaseId?: string } = {}): Promise<readonly Note[]> {
  return (await selectNotes(db, projectId, filter)).map(toNote);
}

export async function getNote(db: Db, projectId: string, noteId: string): Promise<Note | null> {
  if (!isUuid(noteId)) {
    return null;
  }
  const [row] = await selectNotes(db, projectId, { id: noteId });
  return row === undefined ? null : toNote(row);
}

/** Form rows left completely blank are not links. */
function dropBlankLinks(value: unknown): unknown {
  const isBlank = (text: unknown): boolean => text === undefined || text === null || (typeof text === 'string' && text.trim() === '');
  return Array.isArray(value)
    ? value.filter((link: unknown) => !(typeof link === 'object' && link !== null && isBlank(Reflect.get(link, 'label')) && isBlank(Reflect.get(link, 'url'))))
    : value;
}

const linkInput = z.object({ label: requiredText('Link label', 120), url: webUrl('Link') });

const noteInput = z.object({
  title: requiredText('Title', 200),
  body: optionalText('Body', 50000),
  releaseId: optionalId,
  pullRequestId: optionalId,
  links: z
    .preprocess(dropBlankLinks, z.array(linkInput).max(20, 'At most 20 links.'))
    .optional()
    .transform((links) => links ?? []),
});

/** BR-33, BR-34, BR-35 */
async function saveNote(db: Db, projectId: string, noteId: string | null, input: unknown): Promise<ServiceResult<{ readonly id: string }>> {
  const parsed = parseInput(noteInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  const { links, ...values } = parsed.value;
  const errors = await referenceErrors(db, projectId, { releaseId: values.releaseId, pullRequestId: values.pullRequestId });
  if (Object.keys(errors).length > 0) {
    return invalid(errors);
  }
  const id = await db.transaction().execute(async (trx) => {
    if (noteId === null) {
      return await insertNote(trx, projectId, values, links);
    }
    return (await updateNoteRow(trx, projectId, noteId, values, links)) ? noteId : null;
  });
  return id === null ? notFound : ok({ id });
}

export async function createNote(db: Db, projectId: string, input: unknown): Promise<ServiceResult<{ readonly id: string }>> {
  return await saveNote(db, projectId, null, input);
}

export async function updateNote(db: Db, projectId: string, noteId: string, input: unknown): Promise<ServiceResult<{ readonly id: string }>> {
  return isUuid(noteId) ? await saveNote(db, projectId, noteId, input) : notFound;
}

/** BR-36 */
export async function deleteNote(db: Db, projectId: string, noteId: string): Promise<ServiceResult<null>> {
  if (!isUuid(noteId)) {
    return notFound;
  }
  return (await deleteNoteRow(db, projectId, noteId)) ? ok(null) : notFound;
}
