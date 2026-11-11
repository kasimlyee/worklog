import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { appDatabase, appTimeZone, appToday } from '#src/server/app-context.ts';
import { requireSession } from '#src/server/auth/next-session.ts';
import { deletePlanItemAction, movePlanItemAction, setPlanItemStatusAction, updatePlanItemAction } from '#src/server/actions/plans.ts';
import { periodLabel, planStartFor } from '#src/server/domain/plans.ts';
import { toPlanItemDetailVM } from '#src/server/mappers/view-models.ts';
import { getPlanItem } from '#src/server/services/plans.ts';
import { PlanItemScreen } from '#src/ui/components/plan-item-screen.tsx';
import { loadPickers, requireProject } from '#src/app/_lib/loaders.ts';

export const metadata: Metadata = { title: 'Plan item' };

export default async function PlanItemPage({ params }: PageProps<'/projects/[projectId]/plans/items/[itemId]'>): Promise<React.JSX.Element> {
  await requireSession();
  const { projectId, itemId } = await params;
  const project = await requireProject(projectId);
  const [item, pickers] = await Promise.all([getPlanItem(appDatabase(), project.id, itemId, appToday()), loadPickers(project.id)]);
  if (item === null) {
    notFound();
  }
  const start = planStartFor(item.horizon, item.dueDate);
  const planLabel = start.ok ? periodLabel(item.horizon, start.value) : '';
  return (
    <PlanItemScreen
      projectId={project.id}
      item={toPlanItemDetailVM(item, planLabel, appTimeZone())}
      pickers={pickers}
      update={updatePlanItemAction.bind(null, project.id, item.id)}
      move={movePlanItemAction.bind(null, project.id, item.id)}
      setStatus={setPlanItemStatusAction.bind(null, project.id)}
      remove={deletePlanItemAction.bind(null, project.id)}
    />
  );
}
