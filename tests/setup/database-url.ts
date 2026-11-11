// Admin connection for the test harness. CI sets TEST_DATABASE_URL to its service container.
export const adminDatabaseUrl =
  process.env['TEST_DATABASE_URL'] ?? 'postgres://worklog:worklog@127.0.0.1:5433/worklog';

export const templateDatabase = 'worklog_test_template';

export function databaseUrl(database: string): string {
  const url = new URL(adminDatabaseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}
