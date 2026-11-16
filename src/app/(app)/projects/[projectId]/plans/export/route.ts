import { appDatabase, appToday } from '#src/server/app-context.ts';
import { currentSession } from '#src/server/auth/next-session.ts';
import { env } from '#src/server/env.ts';
import { exportPlan } from '#src/server/http/plan-export.ts';

/** BR-47: GET …/plans/export?kind=weekly|monthly&start=&format=pdf|md. Checks the session itself. */
export async function GET(request: Request, { params }: RouteContext<'/projects/[projectId]/plans/export'>): Promise<Response> {
  const session = await currentSession();
  return await exportPlan(request, {
    db: appDatabase(),
    isSignedIn: session !== null,
    projectId: (await params).projectId,
    today: appToday(),
    author: env().REPORT_AUTHOR_NAME,
  });
}
