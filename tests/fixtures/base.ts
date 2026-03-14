import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

export interface MonitoringFixtures {
  /** Authenticated ERP page */
  erpPage: Page;
  /** Authenticated SSRS page */
  ssrsPage: Page;
  /** Site context info */
  siteContext: SiteContext;
  /** Performance measurement helper */
  measure: MeasureHelper;
}

export interface SiteContext {
  siteId:    string;
  siteName:  string;
  baseUrl:   string;
  ssrsUrl:   string;
  mwBaseUrl: string;
}

export interface MeasureHelper {
  start(label: string): void;
  end(label: string): number;
  record(label: string, ms: number): void;
  getAll(): Record<string, number>;
}

export const test = base.extend<MonitoringFixtures>({
  siteContext: async ({}, use) => {
    const ctx: SiteContext = {
      siteId:    process.env.SITE_ID    || 'default',
      siteName:  process.env.SITE_NAME  || 'Default',
      baseUrl:   process.env.BASE_URL   || 'https://erp.example.com',
      ssrsUrl:   process.env.SSRS_BASE_URL || 'https://reports.example.com/ReportServer',
      mwBaseUrl: process.env.MIDDLEWARE_BASE_URL || 'https://api.example.com',
    };
    await use(ctx);
  },

  measure: async ({}, use) => {
    const marks: Record<string, number> = {};
    const results: Record<string, number> = {};

    const helper: MeasureHelper = {
      start(label) { marks[label] = Date.now(); },
      end(label) {
        const ms = Date.now() - (marks[label] ?? Date.now());
        results[label] = ms;
        return ms;
      },
      record(label, ms) { results[label] = ms; },
      getAll() { return { ...results }; },
    };

    await use(helper);

    // Attach measurements to test as annotation
    const annotations = Object.entries(results)
      .map(([k, v]) => `${k}=${v}ms`)
      .join(', ');
    if (annotations) {
      test.info().annotations.push({ type: 'perf', description: annotations });
    }
  },

  erpPage: async ({ browser, siteContext }, use) => {
    const storageStatePath = process.env.STORAGE_STATE || '.auth/state.json';
    let context: BrowserContext;

    if (fs.existsSync(storageStatePath)) {
      context = await browser.newContext({ storageState: storageStatePath });
    } else {
      context = await browser.newContext();
    }

    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  ssrsPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      httpCredentials: {
        username: process.env.SSRS_USERNAME || '',
        password: process.env.SSRS_PASSWORD || '',
      },
      ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === 'true',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
