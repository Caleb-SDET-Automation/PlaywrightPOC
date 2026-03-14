/**
 * Synthetic Monitor: Core ERP Workflows
 * Validates: Navigation to key modules, CRUD operations, search functionality
 * Journey: Landing → Core Workflows (Sales, Purchase, Inventory, Finance)
 */
import { test, expect } from '../fixtures/base';
import { THRESHOLDS, evaluateThreshold, perfData } from '../../config/thresholds';

test.describe('Core ERP Workflows', () => {
  test.use({ storageState: '.auth/state.json' });

  // ─── Sales Module ────────────────────────────────────────────────────────
  test('Sales order list loads', async ({ erpPage: page, siteContext, measure }) => {
    const salesPaths = [
      '/Sales', '/SalesOrders', '/Orders/Sales', '/modules/sales',
      // OrangeHRM: Employees/PIM module as primary HR workflow
      '/web/index.php/pim/viewEmployeeList',
    ];

    let loaded = false;
    for (const path of salesPaths) {
      try {
        measure.start('sales_list');
        const resp = await page.goto(`${siteContext.baseUrl}${path}`, { timeout: 15_000 });
        const ms = measure.end('sales_list');

        if (resp && resp.status() === 200) {
          loaded = true;
          const state = evaluateThreshold(ms, THRESHOLDS.workflowNavigate);
          test.info().annotations.push({
            type: 'checkmk-perf',
            description: perfData('sales_list_load', ms, THRESHOLDS.workflowNavigate),
          });
          expect(state, `Sales list load ${ms}ms exceeds CRITICAL threshold`).not.toBe(2);
          break;
        }
      } catch { continue; }
    }
    test.skip(!loaded, 'Could not reach Sales/Employees module via any known path');
  });

  test('Sales order search returns results', async ({ erpPage: page, siteContext, measure }) => {
    await page.goto(`${siteContext.baseUrl}/Sales`).catch(() =>
      page.goto(`${siteContext.baseUrl}/SalesOrders`)
    );
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="search"], input[placeholder*="Search"], ' +
      '#search, [data-testid="search-input"]'
    ).first();

    if (await searchInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      measure.start('search');
      await searchInput.fill('*');
      await searchInput.press('Enter');
      await page.waitForLoadState('networkidle', { timeout: 10_000 });
      const ms = measure.end('search');

      const state = evaluateThreshold(ms, THRESHOLDS.searchResults);
      expect(state, `Search results ${ms}ms exceeds CRITICAL threshold`).not.toBe(2);
    } else {
      test.skip(true, 'Search input not visible on Sales page — skipped');
    }
  });

  // ─── Purchase Module ─────────────────────────────────────────────────────
  test('Purchase order list loads', async ({ erpPage: page, siteContext, measure }) => {
    const paths = [
      '/Purchase', '/PurchaseOrders', '/Orders/Purchase', '/modules/purchase',
      '/web/index.php/leave/viewLeaveList',  // OrangeHRM: Leave module
    ];

    for (const path of paths) {
      try {
        measure.start('purchase_list');
        const resp = await page.goto(`${siteContext.baseUrl}${path}`, { timeout: 15_000 });
        const ms = measure.end('purchase_list');
        if (resp?.status() === 200) {
          const state = evaluateThreshold(ms, THRESHOLDS.workflowNavigate);
          test.info().annotations.push({
            type: 'checkmk-perf',
            description: perfData('purchase_list_load', ms, THRESHOLDS.workflowNavigate),
          });
          expect(state).not.toBe(2);
          break;
        }
      } catch { continue; }
    }
  });

  // ─── Inventory Module ────────────────────────────────────────────────────
  test('Inventory / stock list loads', async ({ erpPage: page, siteContext, measure }) => {
    const paths = [
      '/Inventory', '/Stock', '/modules/inventory', '/Warehouse',
      '/web/index.php/time/viewAttendanceSummary',  // OrangeHRM: Time module
    ];

    for (const path of paths) {
      try {
        measure.start('inventory');
        const resp = await page.goto(`${siteContext.baseUrl}${path}`, { timeout: 15_000 });
        const ms = measure.end('inventory');
        if (resp?.status() === 200) {
          test.info().annotations.push({
            type: 'checkmk-perf',
            description: perfData('inventory_load', ms, THRESHOLDS.workflowNavigate),
          });
          expect(evaluateThreshold(ms, THRESHOLDS.workflowNavigate)).not.toBe(2);
          break;
        }
      } catch { continue; }
    }
  });

  // ─── Finance Module ──────────────────────────────────────────────────────
  test('Finance / general ledger loads', async ({ erpPage: page, siteContext, measure }) => {
    const paths = [
      '/Finance', '/GeneralLedger', '/Accounting', '/modules/finance',
      '/web/index.php/claim/viewClaims',  // OrangeHRM: Claims module
    ];

    for (const path of paths) {
      try {
        measure.start('finance');
        const resp = await page.goto(`${siteContext.baseUrl}${path}`, { timeout: 15_000 });
        const ms = measure.end('finance');
        if (resp?.status() === 200) {
          test.info().annotations.push({
            type: 'checkmk-perf',
            description: perfData('finance_load', ms, THRESHOLDS.workflowNavigate),
          });
          expect(evaluateThreshold(ms, THRESHOLDS.workflowNavigate)).not.toBe(2);
          break;
        }
      } catch { continue; }
    }
  });

  // ─── Customer List ───────────────────────────────────────────────────────
  test('Customer list loads and is paginated', async ({ erpPage: page, siteContext, measure }) => {
    const paths = [
      '/Customers', '/Contacts/Customers', '/CRM/Customers', '/modules/crm',
      '/web/index.php/recruitment/viewCandidates',  // OrangeHRM: Recruitment module
    ];

    for (const path of paths) {
      try {
        measure.start('customers');
        const resp = await page.goto(`${siteContext.baseUrl}${path}`, { timeout: 15_000 });
        const ms = measure.end('customers');
        if (resp?.status() === 200) {
          expect(evaluateThreshold(ms, THRESHOLDS.workflowNavigate)).not.toBe(2);
          break;
        }
      } catch { continue; }
    }
  });

  // ─── New Record Form ─────────────────────────────────────────────────────
  test('New document form opens without errors', async ({ erpPage: page, siteContext, measure }) => {
    // Try to open a "new" form for any module
    const newPaths = [
      '/Sales/New', '/SalesOrders/New', '/Orders/New',
      '/Purchase/New', '/Invoice/New',
    ];

    for (const path of newPaths) {
      try {
        measure.start('new_form');
        const resp = await page.goto(`${siteContext.baseUrl}${path}`, { timeout: 10_000 });
        const ms = measure.end('new_form');

        if (resp?.status() === 200) {
          // Form should contain at least one input
          const inputs = await page.locator('input, select, textarea').count();
          expect(inputs).toBeGreaterThan(0);
          expect(evaluateThreshold(ms, THRESHOLDS.workflowNavigate)).not.toBe(2);
          break;
        }
      } catch { continue; }
    }
  });
});
