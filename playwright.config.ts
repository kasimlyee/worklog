import { defineConfig, devices } from '@playwright/test';

const isCi = process.env['CI'] !== undefined;
const appPort = 3100;
const fakeGithubPort = 3200;

export default defineConfig({
  testDir: 'tests/e2e',
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
      // Phase 3: serves recorded GitHub PR responses (docs/04 §3.2).
      command: `node tests/e2e/fake-github/server.ts --port ${String(fakeGithubPort)}`,
      port: fakeGithubPort,
      reuseExistingServer: !isCi,
    },
    {
      command: `npm run build && npm run start -- --port ${String(appPort)}`,
      url: `http://localhost:${String(appPort)}/sign-in`,
      reuseExistingServer: !isCi,
      timeout: 180_000,
      env: {
        GITHUB_API_URL: `http://localhost:${String(fakeGithubPort)}`,
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
