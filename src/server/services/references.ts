import 'server-only';
import type { Db } from '#src/server/db/client.ts';
import { checkReferences, type References } from '#src/server/repositories/references.ts';
import type { FieldErrors } from './errors.ts';

/** BR-19: field errors for every reference that is not part of this project. */
export async function referenceErrors(db: Db, projectId: string, refs: References): Promise<FieldErrors> {
  const check = await checkReferences(db, projectId, refs);
  const errors: Record<string, string> = {};
  if (!check.area) {
    errors['areaId'] = 'Choose an area of this project.';
  }
  if (!check.planItem) {
    errors['planItemId'] = 'Choose a plan item of this project.';
  }
  if (!check.issue) {
    errors['issueId'] = 'Choose an issue of this project.';
  }
  if (!check.pullRequest) {
    errors['pullRequestId'] = 'Choose a pull request of this project.';
  }
  if (!check.release) {
    errors['releaseId'] = 'Choose a release of this project.';
  }
  if (!check.people) {
    errors['personIds'] = 'One of the chosen people no longer exists.';
  }
  if (!check.pullRequests) {
    errors['pullRequestIds'] = 'Choose pull requests of this project.';
  }
  return errors;
}
