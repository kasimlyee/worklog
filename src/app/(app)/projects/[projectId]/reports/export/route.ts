import { appDatabase, appToday } from '#src/server/app-context.ts';
import { currentSession } from '#src/server/auth/next-session.ts';
import { env } from '#src/server/env.ts';
import { exportReport } from '#src/server/http/report-export.ts';

/** GET …/reports/export?kind=&start=&format=pdf|md (docs/02 §9). Checks the session itself. */
export async function GET(request: Request, { params }: RouteContext<'/projects/[projectId]/reports/export'>): Promise<Response> {
  const session = await currentSession();
  return await exportReport(request, {
    db: appDatabase(),
    isSignedIn: session !== null,
    projectId: (await params).projectId,
    today: appToday(),
    author: env().REPORT_AUTHOR_NAME,
  });
}
