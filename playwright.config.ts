import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration — SparkOS Fitness (Hebrew RTL PWA)
 *
 * Targets the production preview bundle (`npm run preview`).
 * Chromium-only to keep CI lightweight; mobile Pixel 5 project included
 * because this is a mobile-first PWA.
 *
 * Run locally:  npm run test:e2e
 * Debug:        npx playwright test --headed --debug
 * Reports:      npx playwright show-report
 */
export default defineConfig({
  testDir: './e2e',

  /* The visual-QA spec is a screenshot generator for manual review, not an
     assertion suite: it writes ~50 PNGs and would make CI slow and noisy.
     Run it locally with `npx playwright test e2e/visual-qa.spec.ts`. */
  testIgnore: process.env.CI ? ['**/visual-qa.spec.ts'] : [],

  /* A stray `test.only` must fail the build rather than silently skip the suite. */
  forbidOnly: !!process.env.CI,

  /* Maximum time for a single test to run (ms). */
  timeout: 30_000,

  /* Expect assertion timeout (ms). */
  expect: {
    timeout: 8_000,
  },

  /* Retry once on CI / first-run failure to reduce flakiness noise. */
  retries: 1,

  /* Run tests in parallel — safe because each test gets an isolated browser context. */
  fullyParallel: true,

  /* Reporter: HTML for interactive review + standard list for console. */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  /* Global artifacts captured per test. */
  use: {
    baseURL: 'http://localhost:4173',

    /* Capture trace on the first retry (great for debugging failures). */
    trace: 'on-first-retry',

    /* Screenshot only when a test fails. */
    screenshot: 'only-on-failure',

    /* Video retained on failure. */
    video: 'retain-on-failure',

    /* Locale / timezone aligned with an Israeli user. */
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
  },

  /* Named browser projects. */
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome (Pixel 5)',
      use: { ...devices['Pixel 5'] },
    },
  ],

  /* Spin up `npm run preview` automatically before running the suite.
   * reuseExistingServer: true lets developers keep a preview server running
   * manually and skip the startup time. */
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    // Locally this lets a developer keep a preview running; in CI it must always
    // start a fresh server against the freshly built bundle.
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    /* Show preview server stdout only on failure so output is quiet in CI. */
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
