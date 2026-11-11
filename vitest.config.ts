import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

// `server-only` throws outside a React Server Components build. Under Vitest it is
// replaced with an empty module; the real guard still applies to the Next.js build.
const serverOnlyStub = fileURLToPath(new URL('./tests/setup/server-only-stub.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: { 'server-only': serverOnlyStub },
  },
  test: {
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    passWithNoTests: false,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
          exclude: [...configDefaults.exclude, '**/*.int.test.ts', '**/*.perf.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.int.test.ts'],
          // Created in Phase 1.0: migrates a template database once per run,
          // then gives every worker its own copy (docs/03 §3.1).
          globalSetup: ['tests/setup/global-db.ts'],
          setupFiles: ['tests/setup/worker-db.ts'],
          testTimeout: 15_000,
        },
      },
      {
        // docs/04 §4.5, nightly: large seeded data, timing targets and query plans.
        extends: true,
        test: {
          name: 'perf',
          environment: 'node',
          include: ['src/**/*.perf.test.ts'],
          globalSetup: ['tests/setup/global-db.ts'],
          setupFiles: ['tests/setup/perf-db.ts'],
          testTimeout: 60_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/**/*.ui.test.tsx'],
          setupFiles: ['tests/setup/ui.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.ts',
        '**/*.int.test.ts',
        '**/*.ui.test.tsx',
        '**/*.perf.test.ts',
        'src/app/**',
        'src/proxy.ts',
        'src/ui/fixtures/**',
        'src/server/db/migrations/**',
      ],
      reporter: ['text-summary', 'html'],
      // docs/03-engineering-standards.md §3.2
      thresholds: {
        lines: 80,
        branches: 75,
        'src/server/domain/**': { lines: 100, branches: 100 },
        'src/server/reports/**': { lines: 95, branches: 90 },
        'src/server/services/**': { lines: 90, branches: 85 },
      },
    },
  },
});
