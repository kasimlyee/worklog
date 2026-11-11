import type { Metadata } from 'next';
import { appDatabase, appToday } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { createEntryAction } from '#src/server/actions/entries.ts';
import { toLogDays } from '#src/server/mappers/view-models.ts';
import { listEntries } from '#src/server/services/entries.ts';
import { LogScreen } from '#src/ui/components/log-screen.tsx';
import { loadPickers, param, requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'Log' };

export default async function LogPage({ params, searchParams }: PageProps<'/projects/[projectId]/log'>): Promise<React.JSX.Element> {
  await requireSession();
  const project = await requireProject((await params).projectId);
  const query = await searchParams;
  const filters = { areaId: param(query, 'areaId'), personId: param(query, 'personId'), pullRequestId: param(query, 'pullRequestId') };
  const active = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
  const cursor = param(query, 'cursor');
  const [page, pickers] = await Promise.all([
    listEntries(appDatabase(), project.id, { ...active, ...(cursor === '' ? {} : { cursor }) }),
    loadPickers(project.id),
  ]);
  const nextPageQuery = page.nextCursor === null ? null : new URLSearchParams({ ...active, cursor: page.nextCursor }).toString();
  return (
    <LogScreen
      projectId={project.id}
      vm={{ days: toLogDays(page), filters, isFiltered: Object.keys(active).length > 0, nextPageQuery }}
      pickers={pickers}
      createEntry={createEntryAction.bind(null, project.id)}
      today={appToday()}
    />
  );
}
