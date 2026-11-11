import { defineConfig, devices } from '@playwright/test';

const isCi = process.env['CI'] !== undefined;
const appPort = 3100;
const fakeGithubPort = 3200;
const e2eDatabaseUrl = process.env['E2E_DATABASE_URL'] ?? 'postgres://worklog:worklog@127.0.0.1:5433/worklog_e2e';

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  // One shared test database: journeys run one at a time and reset data themselves.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${String(appPort)}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      // Serves recorded GitHub PR responses (docs/04 §3.2).
      command: `node tests/e2e/fake-github/server.ts --port ${String(fakeGithubPort)}`,
      env: { NODE_OPTIONS: '' },
      url: `http://127.0.0.1:${String(fakeGithubPort)}/health`,
      reuseExistingServer: !isCi,
    },
    {
      command: `npm run build && npm run start -- --port ${String(appPort)}`,
      url: `http://localhost:${String(appPort)}/sign-in`,
      reuseExistingServer: !isCi,
      timeout: 240_000,
      env: {
        // The test runner needs the react-server condition; Next.js must not inherit it.
        NODE_OPTIONS: '',
        APP_URL: `http://localhost:${String(appPort)}`,
        APP_TIME_ZONE: 'Africa/Kampala',
        DATABASE_URL: e2eDatabaseUrl,
        GITHUB_OAUTH_CLIENT_ID: 'e2e-client',
        GITHUB_OAUTH_CLIENT_SECRET: 'e2e-secret',
        ALLOWED_GITHUB_USER_ID: '4242',
        GITHUB_PR_TOKEN: 'e2e-token',
        GITHUB_ALLOWED_ORGS: 'acme',
        GITHUB_API_URL: `http://localhost:${String(fakeGithubPort)}`,
        REPORT_AUTHOR_NAME: 'Kasim Test',
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Phase 4 cross-browser and phone coverage (run with `npm run test:e2e:all`).
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
});
