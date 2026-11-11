import type { Metadata } from 'next';
import { appDatabase, appTimeZone, appToday } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { createPlanItemAction, setPlanItemStatusAction } from '#src/server/actions/plans.ts';
import { monthStart, parseIsoDate, weekStart } from '#src/server/domain/calendar.ts';
import { horizons, type Horizon } from '#src/server/domain/plans.ts';
import { toPlansVM } from '#src/server/mappers/view-models.ts';
import { getPlan } from '#src/server/services/plans.ts';
import { PlansScreen } from '#src/ui/components/plans-screen.tsx';
import { loadPickers, param, requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'Plans' };

function isHorizon(value: string): value is Horizon {
  return horizons.some((horizon) => horizon === value);
}

export default async function PlansPage({ params, searchParams }: PageProps<'/projects/[projectId]/plans'>): Promise<React.JSX.Element> {
  await requireSession();
  const project = await requireProject((await params).projectId);
  const query = await searchParams;
  const today = appToday();
  const requested = param(query, 'horizon');
  const horizon: Horizon = isHorizon(requested) ? requested : 'week';
  const date = parseIsoDate(param(query, 'date')) ?? today;
  // Any date in the period works in the URL; a weekend date shows its own (empty) day.
  const start = horizon === 'week' ? weekStart(date) : horizon === 'month' ? monthStart(date) : date;
  const [plan, pickers] = await Promise.all([getPlan(appDatabase(), project.id, horizon, start, today), loadPickers(project.id)]);
  return (
    <PlansScreen
      projectId={project.id}
      vm={toPlansVM(plan, horizon, start, today, appTimeZone())}
      pickers={pickers}
      createItem={createPlanItemAction.bind(null, project.id)}
      setStatus={setPlanItemStatusAction.bind(null, project.id)}
    />
  );
}
