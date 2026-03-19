/**
 * Playwright config — Demo App only
 *
 * Starts demo-app/index.js automatically via webServer,
 * then runs tests/synthetic/demo-app.spec.ts against it.
 *
 * Usage:
 *   npx playwright test --config=playwright.config.demo.ts
 *   npx playwright test --config=playwright.config.demo.ts --headed
 *   npx playwright show-report reports/html-demo
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = parseInt(process.env.DEMO_PORT || '3333', 10);

export default defineConfig({
  testDir:       './tests/synthetic',
  // Run both demo-app + OrangeHRM demo specs.
  testMatch:     /(?:demo-app|orangehrm)\.spec\.ts/,
  timeout:       6 * 60_000, // allow long end-to-end demo flow
  expect:        { timeout: 30_000 },
  fullyParallel: true,
  retries:       0,
  workers:       parseInt(process.env.DEMO_WORKERS || '2', 10),

  // Put demo run artifacts (videos/traces/screens) somewhere obvious.
  outputDir: 'reports/artifacts-demo',

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html-demo', open: 'never' }],
  ],

  use: {
    baseURL:    `http://localhost:${PORT}`,
    headless:   process.env.HEADLESS !== 'false',
    screenshot: 'on',
    video:      { mode: 'on' },
    trace:      'on',
  },

  projects: [
    {
      name: 'demo-chromium',
      use:  { ...devices['Desktop Chrome'] },
    },
  ],

  /* Auto-start the demo server before tests, reuse if already running */
  webServer: {
    command:             `node demo-app/index.js`,
    url:                 `http://localhost:${PORT}/health`,
    // Always reuse if already running (local dev + CI stability).
    reuseExistingServer: true,
    timeout:             10_000,
    env: {
      DEMO_PORT:     String(PORT),
      DEMO_USERNAME: process.env.DEMO_USERNAME || 'admin',
      DEMO_PASSWORD: process.env.DEMO_PASSWORD || 'demo1234',
    },
  },
});
