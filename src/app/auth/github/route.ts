import { env } from '#src/server/env.ts';
import { startSignIn } from '#src/server/auth/oauth.ts';

/** docs/02 §7 step 1. Public by design: it only starts the GitHub sign-in. */
export function GET(request: Request): Response {
  const config = env();
  return startSignIn(request, {
    config: {
      clientId: config.GITHUB_OAUTH_CLIENT_ID,
      clientSecret: config.GITHUB_OAUTH_CLIENT_SECRET,
      appUrl: config.APP_URL,
      apiUrl: config.GITHUB_API_URL,
      allowedUserId: config.ALLOWED_GITHUB_USER_ID,
    },
  });
}
