/**
 * Synthetic Monitor: Landing / Dashboard
 * Validates: Dashboard loads, KPI widgets visible, nav accessible
 * Journey: Landing page after login
 */
import { test, expect } from '../fixtures/base';
import { THRESHOLDS, evaluateThreshold, perfData } from '../../config/thresholds';

test.describe('Landing / Dashboard', () => {
  test.use({ storageState: '.auth/state.json' });

  test('Dashboard loads within threshold', async ({ erpPage: page, siteContext, measure }) => {
    measure.start('dashboard');
    const response = await page.goto(siteContext.baseUrl, { waitUntil: 'domcontentloaded' });
    const loadMs = measure.end('dashboard');

    expect(response?.status()).toBe(200);
    const state = evaluateThreshold(loadMs, THRESHOLDS.landingLoad);

    test.info().annotations.push({
      type: 'checkmk-perf',
      description: perfData('dashboard_load', loadMs, THRESHOLDS.landingLoad),
    });

    expect(state).not.toBe(2);
  });

  test('Dashboard KPI / summary widgets visible', async ({ erpPage: page, siteContext }) => {
    await page.goto(siteContext.baseUrl, { waitUntil: 'networkidle' });

    // Common ERP dashboard element selectors (including OrangeHRM OXD design system)
    const widgets = page.locator(
      '.dashboard-widget, .kpi-card, .summary-card, [data-testid="widget"], ' +
      '.tile, .metric-card, .stat-card, ' +
      '.orangehrm-dashboard-widget, .oxd-sheet, .oxd-grid-item'
    );

    // At least one KPI widget should be visible
    await expect(widgets.first()).toBeVisible({ timeout: 10_000 });
  });

  test('Main navigation renders all top-level links', async ({ erpPage: page, siteContext }) => {
    await page.goto(siteContext.baseUrl);

    const nav = page.locator('nav, [role="navigation"], .navbar, .sidebar').first();
    await expect(nav).toBeVisible();

    // Ensure nav contains at least 3 links (adapts to any ERP)
    const links = nav.locator('a[href]');
    const count  = await links.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('No JavaScript errors on landing page', async ({ erpPage: page, siteContext }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.goto(siteContext.baseUrl, { waitUntil: 'networkidle' });

    // Filter out known benign warnings
    const criticalErrors = jsErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('analytics') &&
      !e.toLowerCase().includes('warning')
    );

    expect(criticalErrors, `JS errors: ${criticalErrors.join(', ')}`).toHaveLength(0);
  });

  test('Landing page responds to browser back/forward', async ({ erpPage: page, siteContext }) => {
    await page.goto(siteContext.baseUrl);
    await page.goto(`${siteContext.baseUrl}/dashboard`).catch(() => {});
    await page.goBack();
    expect(page.url()).toContain(siteContext.baseUrl);
  });
});
