import type { Metadata } from 'next';
import { appDatabase } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { createPersonAction, renamePersonAction, setPersonArchivedAction } from '#src/server/actions/projects.ts';
import { toPersonVM } from '#src/server/mappers/view-models.ts';
import { listPeople } from '#src/server/services/projects.ts';
import { PeopleScreen } from '#src/ui/components/settings-screens.tsx';

export const metadata: Metadata = { title: 'People' };

export default async function PeoplePage(): Promise<React.JSX.Element> {
  await requireSession();
  const people = await listPeople(appDatabase(), { includeArchived: true });
  return <PeopleScreen people={people.map(toPersonVM)} create={createPersonAction} rename={renamePersonAction} setArchived={setPersonArchivedAction} />;
}
