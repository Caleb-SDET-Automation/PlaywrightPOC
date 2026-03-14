/**
 * Authentication Setup
 * Runs once before all synthetic tests to obtain and persist session state.
 */
import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_FILE = '.auth/state.json';

setup('authenticate', async ({ page }) => {
  const baseUrl   = process.env.BASE_URL   || 'https://erp.example.com';
  const username  = process.env.ERP_USERNAME || 'monitor_user';
  const password  = process.env.ERP_PASSWORD || 'changeme';
  const loginPath = process.env.LOGIN_PATH  || '/Account/Login';

  const preflightPath = process.env.LOGIN_PREFLIGHT_URL || '';

  // Always start fresh
  await page.context().clearCookies();

  if (preflightPath) {
    // Some demo instances (e.g. Dolibarr) require submitting a profile-selection
    // form before the login page becomes accessible. Visit the preflight URL and
    // click the first navigable link/button that leads toward the login form.
    await page.goto(`${baseUrl}${preflightPath}`, { waitUntil: 'domcontentloaded' });
    const profileLink = page.locator('a[href*="urlfrom"], a[href*="disablemodules"], .demo-profile-link').first();
    if (await profileLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await profileLink.click();
      await page.waitForLoadState('domcontentloaded');
    }
  } else {
    await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'domcontentloaded' });
  }

  // Fill credentials — selectors adapt to common ERP patterns (including OrangeHRM)
  await page.locator(
    'input[name="username"], input[name="UserName"], #username, #UserName, [data-testid="username"], input[autocomplete="username"]'
  ).first().fill(username);

  await page.locator(
    'input[name="password"], input[name="Password"], #password, #Password, [data-testid="password"], input[type="password"]'
  ).first().fill(password);

  await page.locator(
    'button[type="submit"], input[type="submit"], [data-testid="login-btn"], .orangehrm-login-button'
  ).first().click();

  // Wait for successful navigation away from login page.
  // Strategy: wait until URL no longer contains the login-specific query params (urlfrom / auth)
  // or until the URL changes from the loginPath.
  const loginUrl = `${baseUrl}${loginPath}`;
  await page.waitForURL(
    url => url.href !== loginUrl && !url.href.startsWith(loginUrl),
    { timeout: 20_000 }
  );

  // Ensure auth directory exists
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });

  console.log(`[AUTH] Session stored for site: ${process.env.SITE_ID || 'default'}`);
});
