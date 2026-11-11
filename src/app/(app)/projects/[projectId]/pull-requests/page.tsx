import type { Metadata } from 'next';
import { appDatabase } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { addPullRequestAction, deletePullRequestAction, refreshPullRequestAction } from '#src/server/actions/pull-requests.ts';
import { toPullRequestRowVM } from '#src/server/mappers/view-models.ts';
import { listPullRequests } from '#src/server/services/pull-requests.ts';
import { PullRequestsScreen } from '#src/ui/components/settings-screens.tsx';
import { param, requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'Pull requests' };

// Fixed texts for the notice codes the actions put in the URL; anything else is ignored.
const notices: Readonly<Record<string, string>> = {
  'in-use': 'That pull request is used by entries, issues, releases or notes, so it was not deleted.',
  'refresh-failed': 'GitHub could not be reached or refused the request, so nothing was changed. Check the token and try again.',
};

export default async function PullRequestsPage({ params, searchParams }: PageProps<'/projects/[projectId]/pull-requests'>): Promise<React.JSX.Element> {
  await requireSession();
  const project = await requireProject((await params).projectId);
  const notice = notices[param(await searchParams, 'notice')] ?? null;
  const pullRequests = await listPullRequests(appDatabase(), project.id);
  return (
    <PullRequestsScreen
      projectId={project.id}
      pullRequests={pullRequests.map(toPullRequestRowVM)}
      notice={notice}
      add={addPullRequestAction.bind(null, project.id)}
      refresh={refreshPullRequestAction.bind(null, project.id)}
      remove={deletePullRequestAction.bind(null, project.id)}
    />
  );
}
