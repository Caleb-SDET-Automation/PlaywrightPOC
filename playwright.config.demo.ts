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
  testMatch:     /demo-app\.spec\.ts/,
  timeout:       30_000,
  expect:        { timeout: 10_000 },
  fullyParallel: false,
  retries:       0,
  workers:       1,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html-demo', open: 'never' }],
  ],

  use: {
    baseURL:    `http://localhost:${PORT}`,
    headless:   false,
    screenshot: 'on',
    video:      'on',
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
    reuseExistingServer: !process.env.CI,
    timeout:             10_000,
    env: {
      DEMO_PORT:     String(PORT),
      DEMO_USERNAME: process.env.DEMO_USERNAME || 'admin',
      DEMO_PASSWORD: process.env.DEMO_PASSWORD || 'demo1234',
    },
  },
});
