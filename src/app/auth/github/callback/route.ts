import { appDatabase } from '#src/server/app-context.ts';
import { completeSignIn } from '#src/server/auth/oauth.ts';
import { env } from '#src/server/env.ts';

/** docs/02 §7 steps 2–6: state check, code exchange, allow-list, session. */
export async function GET(request: Request): Promise<Response> {
  const config = env();
  return await completeSignIn(request, {
    db: appDatabase(),
    fetch,
    now: () => new Date(),
    config: {
      clientId: config.GITHUB_OAUTH_CLIENT_ID,
      clientSecret: config.GITHUB_OAUTH_CLIENT_SECRET,
      appUrl: config.APP_URL,
      apiUrl: config.GITHUB_API_URL,
      allowedUserId: config.ALLOWED_GITHUB_USER_ID,
    },
  });
}
