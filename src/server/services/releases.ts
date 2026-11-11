import 'server-only';
import * as z from 'zod';
import { ok } from '#src/lib/result.ts';
import type { Db } from '#src/server/db/client.ts';
import { isUniqueViolation } from '#src/server/db/errors.ts';
import type { ReleaseStatus } from '#src/server/db/types.ts';
import type { IsoDate } from '#src/server/domain/calendar.ts';
import {
  deleteReleaseRow, insertRelease, selectReleases, updateReleaseRow, type ReleaseRow,
} from '#src/server/repositories/releases.ts';
import { invalid, notFound, parseInput, type ServiceResult } from './errors.ts';
import { idList, isUuid, oneOf, optionalDate, optionalText, requiredText } from './fields.ts';
import { renderMarkdown } from './markdown.ts';
import { toPullRequest, type PullRequest } from './pull-requests.ts';
import { referenceErrors } from './references.ts';

export type Release = {
  readonly id: string;
  readonly version: string;
  readonly status: ReleaseStatus;
  readonly targetDate: IsoDate | null;
  readonly releasedOn: IsoDate | null;
  readonly notes: string;
  readonly notesHtml: string;
  readonly pullRequests: readonly PullRequest[];
};

function toRelease(row: ReleaseRow): Release {
  return { ...row, notesHtml: renderMarkdown(row.notes), pullRequests: row.pullRequests.map(toPullRequest) };
}

export async function listReleases(db: Db, projectId: string): Promise<readonly Release[]> {
  return (await selectReleases(db, projectId)).map(toRelease);
}

export async function getRelease(db: Db, projectId: string, releaseId: string): Promise<Release | null> {
  if (!isUuid(releaseId)) {
    return null;
  }
  const [row] = await selectReleases(db, projectId, { id: releaseId });
  return row === undefined ? null : toRelease(row);
}

/** BR-32 */
const releaseInput = z
  .object({
    version: requiredText('Version', 50),
    status: oneOf(['planned', 'released'], 'status'),
    targetDate: optionalDate('Target date'),
    releasedOn: optionalDate('Released date'),
    notes: optionalText('Notes', 20000),
    pullRequestIds: idList('pull request', { max: 200 }),
  })
  .refine((release) => release.status === 'planned' || release.releasedOn !== null, {
    message: 'A released version needs its released date.',
    path: ['releasedOn'],
  })
  .transform((release) => ({ ...release, releasedOn: release.status === 'released' ? release.releasedOn : null }));

const duplicateVersion = invalid({ version: 'This project already has a release with this version.' });

async function saveRelease(
  db: Db,
  projectId: string,
  releaseId: string | null,
  input: unknown,
): Promise<ServiceResult<{ readonly id: string }>> {
  const parsed = parseInput(releaseInput, input);
  if (!parsed.ok) {
    return parsed;
  }
  const { pullRequestIds, ...values } = parsed.value;
  const errors = await referenceErrors(db, projectId, { pullRequestIds });
  if (Object.keys(errors).length > 0) {
    return invalid(errors);
  }
  try {
    const id = await db.transaction().execute(async (trx) => {
      if (releaseId === null) {
        return await insertRelease(trx, projectId, values, pullRequestIds);
      }
      return (await updateReleaseRow(trx, projectId, releaseId, values, pullRequestIds)) ? releaseId : null;
    });
    return id === null ? notFound : ok({ id });
  } catch (error) {
    if (isUniqueViolation(error, 'releases_project_id_version_key')) {
      return duplicateVersion;
    }
    throw error;
  }
}

export async function createRelease(db: Db, projectId: string, input: unknown): Promise<ServiceResult<{ readonly id: string }>> {
  return await saveRelease(db, projectId, null, input);
}

export async function updateRelease(db: Db, projectId: string, releaseId: string, input: unknown): Promise<ServiceResult<{ readonly id: string }>> {
  return isUuid(releaseId) ? await saveRelease(db, projectId, releaseId, input) : notFound;
}

/** BR-36. Notes attached to it stay, detached. */
export async function deleteRelease(db: Db, projectId: string, releaseId: string): Promise<ServiceResult<null>> {
  if (!isUuid(releaseId)) {
    return notFound;
  }
  return (await deleteReleaseRow(db, projectId, releaseId)) ? ok(null) : notFound;
}
