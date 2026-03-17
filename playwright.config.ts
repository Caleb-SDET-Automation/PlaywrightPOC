import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const SITE_ID = process.env.SITE_ID || 'default';
const RUN_MODE = process.env.RUN_MODE || 'synthetic'; // synthetic | rum
const WORKERS = parseInt(process.env.WORKERS || '4', 10);
const RETRIES = parseInt(process.env.RETRIES || '1', 10);

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: process.env.CI === 'true',
  retries: RETRIES,
  workers: WORKERS,

  /* Reporters */
  reporter: [
    ['list'],
    ['json',  { outputFile: `reports/json/results-${SITE_ID}-${Date.now()}.json` }],
    ['html',  { outputFolder: 'reports/html', open: 'never' }],
    ['./lib/reporters/checkmk-reporter.ts'],
    ['./lib/reporters/consolidated-reporter.ts'],
  ],

  use: {
    /* Base URL set per-site via env */
    baseURL: process.env.BASE_URL || 'https://erp.example.com',

    /* Headed/headless based on mode */
    headless: process.env.HEADLESS !== 'false',

    /* Screenshots on failure */
    screenshot: 'only-on-failure',
    video:      'retain-on-failure',
    trace:      'on-first-retry',

    /* Auth storage per site — only if file exists */
    storageState: (() => {
      const p = process.env.STORAGE_STATE || '.auth/state.json';
      return fs.existsSync(p) ? p : undefined;
    })(),

    /* Timeouts */
    navigationTimeout: 30_000,
    actionTimeout:     10_000,

    /* Extra HTTP headers for monitoring identification */
    extraHTTPHeaders: {
      'X-Monitoring-Source': 'playwright-synthetic',
      'X-Site-ID':           SITE_ID,
    },

    ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === 'true',
  },

  /* Test projects — one per browser type for local runs.
     For 80+ site runs the orchestrator launches separate playwright
     processes per site using run-all-sites.js */
  projects: [
    /* Setup: authenticate once and save storage state */
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { storageState: undefined }, // Never inherit stored session — always log in fresh
    },

    /* Synthetic monitoring — Chrome */
    {
      name: 'synthetic-chromium',
      testMatch: /tests\/synthetic\/.*.spec.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Use system Chrome (not bundled Chromium) so that Cloudflare-protected
        // sites are not blocked by headless-Chromium TLS fingerprinting.
        // Falls back gracefully if channel is unavailable.
        channel: 'chrome',
        // Give Dolibarr and similar heavy-JS pages more time before DOMContentLoaded
        navigationTimeout: 60_000,
        storageState: fs.existsSync('.auth/state.json') ? '.auth/state.json' : undefined,
      },
      dependencies: ['setup'],
    },

    /* API checks — pure HTTP, no storage state needed */
    {
      name: 'api-checks',
      testMatch: /tests\/synthetic\/middleware-api\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: undefined },
    },

    /* RUM project — headed with real viewport */
    {
      name: 'rum-chrome',
      testMatch: /tests\/rum\/.*.spec.ts/,
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        storageState: '.auth/state.json',
      },
      dependencies: ['setup'],
    },
  ],

  /* Output paths */
  outputDir: 'reports/artifacts',

  webServer: undefined,

  /* Global setup/teardown */
  globalSetup:    './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
});
