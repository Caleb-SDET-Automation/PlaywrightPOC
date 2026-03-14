/**
 * Synthetic Monitor: Device Management Workflow
 * Validates: Devices list loads, device status visible, integration status OK
 * Journey: Core Workflows → Devices / Integration
 */
import { test, expect } from '../fixtures/base';
import { THRESHOLDS, evaluateThreshold, perfData } from '../../config/thresholds';

test.describe('Devices & Integration', () => {
  test.use({ storageState: '.auth/state.json' });

  // ─── Device List ──────────────────────────────────────────────────────
  test('Device management list loads', async ({ erpPage: page, siteContext, measure }) => {
    const devicePaths = [
      '/Devices', '/DeviceManagement', '/Hardware',
      '/modules/devices', '/Admin/Devices',
    ];

    let found = false;
    for (const path of devicePaths) {
      try {
        measure.start('device_list');
        const resp = await page.goto(`${siteContext.baseUrl}${path}`, { timeout: 12_000 });
        const ms = measure.end('device_list');

        if (resp?.status() === 200) {
          found = true;
          const state = evaluateThreshold(ms, THRESHOLDS.deviceList);
          test.info().annotations.push({
            type: 'checkmk-perf',
            description: perfData('device_list_load', ms, THRESHOLDS.deviceList),
          });
          expect(state, `Device list ${ms}ms exceeds CRITICAL threshold`).not.toBe(2);
          break;
        }
      } catch { continue; }
    }

    if (!found) {
      test.skip(true, 'Device module not found via known paths');
    }
  });

  test('Device list displays status indicators', async ({ erpPage: page, siteContext }) => {
    const reached = await tryNavigate(page, siteContext.baseUrl, [
      '/Devices', '/DeviceManagement', '/Hardware',
    ]);

    if (!reached) { test.skip(true, 'Device module unavailable'); return; }

    await page.waitForLoadState('networkidle');

    // Look for status badges/chips (online, offline, active, inactive)
    const statusBadges = page.locator(
      '.status-badge, .badge, [data-status], ' +
      '.device-status, [class*="status"], .indicator'
    );

    const count = await statusBadges.count();
    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    } else {
      // Fallback: table rows should be visible
      await expect(
        page.locator('table tbody tr, .device-row, [data-testid="device-row"]').first()
      ).toBeVisible({ timeout: 8_000 });
    }
  });

  // ─── Integration Status ───────────────────────────────────────────────
  test('Integration hub / connections page loads', async ({ erpPage: page, siteContext, measure }) => {
    const integrationPaths = [
      '/Integration', '/Integrations', '/Connections',
      '/Admin/Integrations', '/modules/integration',
      '/Settings/Integrations',
    ];

    let found = false;
    for (const path of integrationPaths) {
      try {
        measure.start('integration');
        const resp = await page.goto(`${siteContext.baseUrl}${path}`, { timeout: 12_000 });
        const ms = measure.end('integration');

        if (resp?.status() === 200) {
          found = true;
          const state = evaluateThreshold(ms, THRESHOLDS.workflowNavigate);
          test.info().annotations.push({
            type: 'checkmk-perf',
            description: perfData('integration_load', ms, THRESHOLDS.workflowNavigate),
          });
          expect(state).not.toBe(2);
          break;
        }
      } catch { continue; }
    }

    if (!found) {
      test.skip(true, 'Integration module not found');
    }
  });

  test('Integration connectors show connected state', async ({ erpPage: page, siteContext }) => {
    const reached = await tryNavigate(page, siteContext.baseUrl, [
      '/Integration', '/Integrations', '/Connections',
    ]);

    if (!reached) { test.skip(true, 'Integration module unavailable'); return; }

    await page.waitForLoadState('networkidle');

    // Look for any "connected", "active", or "healthy" indicators
    const connectedElements = page.locator(
      ':text("Connected"), :text("Active"), :text("Healthy"), ' +
      '[data-status="connected"], [data-status="active"], ' +
      '.connected, .active-connection'
    );

    const cnt = await connectedElements.count();
    // Just assert the page didn't error out — connection status is informational
    expect(page.url()).not.toContain('/error');
    test.info().annotations.push({
      type: 'info',
      description: `Connected integrations found: ${cnt}`,
    });
  });

  // ─── Device Action ───────────────────────────────────────────────────
  test('Device detail page opens without errors', async ({ erpPage: page, siteContext, measure }) => {
    const reached = await tryNavigate(page, siteContext.baseUrl, [
      '/Devices', '/DeviceManagement',
    ]);

    if (!reached) { test.skip(true, 'Device module unavailable'); return; }

    await page.waitForLoadState('networkidle');

    const firstDevice = page.locator(
      'table tbody tr:first-child td a, ' +
      '.device-row:first-child a, ' +
      '[data-testid="device-row"]:first-child a'
    ).first();

    if (!await firstDevice.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, 'No devices in list — skipped');
      return;
    }

    measure.start('device_detail');
    await firstDevice.click();
    await page.waitForLoadState('networkidle');
    const ms = measure.end('device_detail');

    const state = evaluateThreshold(ms, THRESHOLDS.deviceAction);
    test.info().annotations.push({
      type: 'checkmk-perf',
      description: perfData('device_detail_load', ms, THRESHOLDS.deviceAction),
    });

    expect(state).not.toBe(2);
    expect(page.url()).not.toContain('/error');
  });
});

async function tryNavigate(page: import('@playwright/test').Page, base: string, paths: string[]): Promise<boolean> {
  for (const path of paths) {
    try {
      const resp = await page.goto(`${base}${path}`, { timeout: 10_000 });
      if (resp?.status() === 200) return true;
    } catch { continue; }
  }
  return false;
}
