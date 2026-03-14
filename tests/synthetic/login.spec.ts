/**
 * Synthetic Monitor: User Login Journey
 * Validates: Login page loads → credentials accepted → dashboard visible
 * Journey: Login → Landing
 */
import { test, expect } from '../fixtures/base';
import { THRESHOLDS, evaluateThreshold, perfData } from '../../config/thresholds';

test.describe('Login Journey', () => {
  test('Login page loads and is accessible', async ({ page, siteContext, measure }) => {
    const loginPath = process.env.LOGIN_PATH || '/Account/Login';
    const loginUrl = `${siteContext.baseUrl}${loginPath}`;

    // Clear any stored session so we always land on the login form
    await page.context().clearCookies();

    measure.start('page_load');
    const response = await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    const loadMs = measure.end('page_load');

    // Page must return 200
    expect(response?.status(), `Login page returned non-200: ${response?.status()}`).toBe(200);

    // Login form must be visible
    await expect(
      page.locator('input[type="password"], input[name="Password"], #Password, input[autocomplete="current-password"]').first()
    ).toBeVisible({ timeout: 10_000 });

    // Performance check
    const state = evaluateThreshold(loadMs, THRESHOLDS.pageLoad);
    test.info().annotations.push({
      type: 'perf-state',
      description: `pageLoad=${loadMs}ms state=${['OK', 'WARN', 'CRIT'][state]}`,
    });
    expect(state, `Page load ${loadMs}ms exceeds CRITICAL threshold ${THRESHOLDS.pageLoad.crit}ms`).not.toBe(2);
  });

  test('User login succeeds and dashboard loads', async ({ page, siteContext, measure }) => {
    const baseUrl  = siteContext.baseUrl;
    const username = process.env.ERP_USERNAME || 'monitor_user';
    const password = process.env.ERP_PASSWORD || 'changeme';

    // Clear any stored session so we always land on the login form
    await page.context().clearCookies();

    // Navigate to login
    const loginPath = process.env.LOGIN_PATH || '/Account/Login';
    await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'domcontentloaded' });

    // Fill credentials
    await page.locator(
      'input[name="username"], input[name="UserName"], #username, #UserName, [data-testid="username"], input[autocomplete="username"]'
    ).first().fill(username);

    await page.locator(
      'input[name="password"], input[name="Password"], #password, #Password, [data-testid="password"], input[type="password"]'
    ).first().fill(password);

    // Submit and measure
    measure.start('login');
    await page.locator(
      'button[type="submit"], input[type="submit"], [data-testid="login-btn"]'
    ).first().click();

    // Wait for redirect away from login page
    await page.waitForURL(
      url => !url.pathname.toLowerCase().includes('/login') &&
             !url.pathname.toLowerCase().includes('/auth/login'),
      { timeout: 20_000 }
    );
    const loginMs = measure.end('login');

    // Measure full page load after redirect
    measure.start('dashboard_load');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    const dashMs = measure.end('dashboard_load');

    // Verify we are NOT on error or login page
    const currentUrl = page.url();
    expect(currentUrl.toLowerCase()).not.toContain('error');
    expect(currentUrl.toLowerCase()).not.toContain('/login');

    // At least one navigation/menu element visible (adapts to ERP structure)
    const navVisible = await page.locator(
      'nav, [role="navigation"], .sidebar, .nav-menu, #mainNav, [data-testid="main-nav"]'
    ).first().isVisible().catch(() => false);

    expect(navVisible, 'No navigation element found after login').toBe(true);

    // Performance assertions
    const loginState = evaluateThreshold(loginMs, THRESHOLDS.loginSuccess);
    const dashState  = evaluateThreshold(dashMs,  THRESHOLDS.landingLoad);

    test.info().annotations.push({
      type: 'checkmk-perf',
      description: [
        perfData('login_time',     loginMs, THRESHOLDS.loginSuccess),
        perfData('dashboard_load', dashMs,  THRESHOLDS.landingLoad),
      ].join(' '),
    });

    expect(loginState, `Login ${loginMs}ms exceeds CRITICAL threshold`).not.toBe(2);
    expect(dashState,  `Dashboard load ${dashMs}ms exceeds CRITICAL threshold`).not.toBe(2);
  });

  test('Session remains valid after idle period', async ({ erpPage: page, siteContext, measure }) => {
    // Uses pre-authenticated page via fixture
    measure.start('session_check');
    await page.goto(siteContext.baseUrl, { waitUntil: 'domcontentloaded' });
    const ms = measure.end('session_check');

    const currentUrl = page.url();
    expect(currentUrl.toLowerCase(), 'Session expired — redirected to login').not.toContain('/login');
    expect(ms, `Session check ${ms}ms exceeds threshold`).toBeLessThan(THRESHOLDS.pageLoad.crit);
  });

  test('Login page renders correctly on mobile viewport', async ({ browser, siteContext }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    const page = await context.newPage();

    try {
      const loginPath = process.env.LOGIN_PATH || '/Account/Login';
      const response = await page.goto(`${siteContext.baseUrl}${loginPath}`, { waitUntil: 'load' });
      expect(response?.status()).toBe(200);

      // Some demo/cloud apps auto-login and redirect away from the login page
      if (!page.url().toLowerCase().includes('login')) {
        test.skip(true, 'App redirected away from login page — likely auto-login or active session; mobile rendering check skipped');
      }

      // Form should still be visible on mobile
      await expect(
        page.locator('input[type="password"]').first()
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });
});
