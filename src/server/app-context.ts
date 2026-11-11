import 'server-only';
import { appDb } from '#src/server/db/app-db.ts';
import type { Db } from '#src/server/db/client.ts';
import { today as todayIn, type IsoDate } from '#src/server/domain/calendar.ts';
import { env } from '#src/server/env.ts';
import { createGitHubClient } from '#src/server/github/client.ts';
import type { PullRequestDeps } from '#src/server/services/pull-requests.ts';

/** BR-02: today in the app time zone, from the real clock. */
export function appToday(): IsoDate {
  return todayIn(new Date(), env().APP_TIME_ZONE);
}

/** Everything the PR-touching services need, wired to the real database and GitHub. */
export function appPullRequestDeps(): PullRequestDeps {
  const config = env();
  return {
    db: appDb(),
    github: createGitHubClient({ fetch, apiUrl: config.GITHUB_API_URL, token: config.GITHUB_PR_TOKEN }),
    allowedOrgs: config.GITHUB_ALLOWED_ORGS,
    now: () => new Date(),
  };
}

/** The application database handle, for passing to services (adapters never query it). */
export function appDatabase(): Db {
  return appDb();
}

export function appTimeZone(): string {
  return env().APP_TIME_ZONE;
}
