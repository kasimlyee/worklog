import type { Metadata } from 'next';
import { appDatabase } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { toEntryVM, toLogDays } from '#src/server/mappers/view-models.ts';
import { getEntry, listEntries } from '#src/server/services/entries.ts';
import { LogScreen } from '#src/ui/components/log-screen.tsx';
import { loadPickers, param, requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'Log' };

export default async function LogPage({ params, searchParams }: PageProps<'/projects/[projectId]/log'>): Promise<React.JSX.Element> {
  await requireSession();
  const project = await requireProject((await params).projectId);
  const query = await searchParams;
  const filters = {
    areaId: param(query, 'areaId'),
    personId: param(query, 'personId'),
    pullRequestId: param(query, 'pullRequestId'),
    // Set by the "Work logged" links on an issue or a plan item.
    issueId: param(query, 'issueId'),
    planItemId: param(query, 'planItemId'),
    q: param(query, 'q').trim().slice(0, 100),
  };
  const active = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
  const cursor = param(query, 'cursor');
  const [page, pickers] = await Promise.all([
    listEntries(appDatabase(), project.id, { ...active, ...(cursor === '' ? {} : { cursor }) }),
    loadPickers(project.id),
  ]);
  const nextPageQuery = page.nextCursor === null ? null : new URLSearchParams({ ...active, cursor: page.nextCursor }).toString();
  // The entry shown beside the list: the one the URL names (from this page, or loaded), else the newest.
  const wanted = param(query, 'entry');
  const fromPage = page.entries.find((entry) => entry.id === wanted) ?? (wanted === '' ? page.entries[0] : undefined);
  const selected = fromPage ?? (wanted === '' ? null : await getEntry(appDatabase(), project.id, wanted)) ?? page.entries[0] ?? null;
  return (
    <LogScreen
      projectId={project.id}
      vm={{
        days: toLogDays(page),
        filters,
        isFiltered: Object.keys(active).length > 0,
        nextPageQuery,
        selected: selected === null ? null : toEntryVM(selected),
        isSelectionExplicit: wanted !== '' && selected?.id === wanted,
        listQuery: new URLSearchParams({ ...active, ...(cursor === '' ? {} : { cursor }) }).toString(),
      }}
      pickers={pickers}
    />
  );
}
