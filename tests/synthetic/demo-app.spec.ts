/**
 * Demo App — 5 single test cases, one per flow
 *
 * Flow 0: API Validation  — /health · /api/inventory · /api/inventory/:id · /api/stats
 * Flow 1: Login           — render, valid/invalid auth, redirect, logout
 * Flow 2: Dashboard       — KPI cards, values, nav links, recent items table
 * Flow 3: Inventory       — 10-row table, SKU integrity, badges, headers
 * Flow 4: Reports         — category & status report cards, data completeness
 *
 * Run:
 *   npx playwright test --config=playwright.config.demo.ts
 */
import { test, expect } from '@playwright/test';

import { LoginPage }          from '../pages/demo/LoginPage';
import { DashboardPage }      from '../pages/demo/DashboardPage';
import { InventoryPage }      from '../pages/demo/InventoryPage';
import { InventoryFormPage }  from '../pages/demo/InventoryFormPage';
import { ReportsPage }        from '../pages/demo/ReportsPage';

const BASE = process.env.BASE_URL      || 'http://localhost:3333';
const USER = process.env.DEMO_USERNAME || 'admin';
const PASS = process.env.DEMO_PASSWORD || 'demo1234';

// Demo app tests mutate shared in-memory inventory, so keep them serial even if the runner is parallel.
test.describe.configure({ mode: 'serial' });

// ─── Flow 1: API Validation ──────────────────────────────────────────────────
test('Flow 1: API Validation', async ({ request }) => {
  // -- /health --
  const healthRes = await request.get(`${BASE}/health`);
  expect(healthRes.status()).toBe(200);
  const health = await healthRes.json();
  expect(health.status).toBe('ok');
  expect(typeof health.uptime).toBe('number');
  expect(health.items).toBe(10);

  // -- /api/inventory: length & schema --
  const listRes = await request.get(`${BASE}/api/inventory`);
  expect(listRes.status()).toBe(200);
  const items = await listRes.json();
  expect(Array.isArray(items)).toBe(true);
  expect(items).toHaveLength(10);

  for (const item of items) {
    expect(item).toMatchObject({
      id:       expect.any(Number),
      sku:      expect.any(String),
      name:     expect.any(String),
      category: expect.any(String),
      qty:      expect.any(Number),
      price:    expect.any(Number),
      status:   expect.stringMatching(/^(in-stock|low-stock|out-of-stock)$/),
    });
    expect(item.sku).toMatch(/^PRD-\d{3}$/);
  }

  // -- /api/inventory/:id: found & not found --
  const itemRes = await request.get(`${BASE}/api/inventory/1`);
  expect(itemRes.status()).toBe(200);
  const item = await itemRes.json();
  expect(item.id).toBe(1);
  expect(item.sku).toBe('PRD-001');
  expect(item.name).toBe('Widget Alpha');

  const missingRes = await request.get(`${BASE}/api/inventory/999`);
  expect(missingRes.status()).toBe(404);

  // -- /api/stats --
  const statsRes = await request.get(`${BASE}/api/stats`);
  expect(statsRes.status()).toBe(200);
  const stats = await statsRes.json();
  expect(stats.totalItems).toBe(10);
  expect(stats.inStock).toBe(6);
  expect(stats.lowStock).toBe(2);
  expect(stats.outOfStock).toBe(2);
  expect(typeof stats.inventoryValue).toBe('number');
  expect(stats.inventoryValue).toBeGreaterThan(0);
  expect(stats.inStock + stats.lowStock + stats.outOfStock).toBe(stats.totalItems);
});

// ─── Flow 2: Login ───────────────────────────────────────────────────────────
test('Flow 2: Login', async ({ page }) => {
  const login = new LoginPage(page);

  // -- page render --
  await login.goto();
  await expect(page).toHaveTitle(/DemoERP/);
  await expect(login.formContainer).toBeVisible();
  await expect(login.usernameInput).toBeVisible();
  await expect(login.passwordInput).toBeVisible();
  await expect(login.submitButton).toBeVisible();

  // -- invalid credentials --
  await login.submit('wrong', 'bad');
  await expect(page).toHaveURL(/error=1/);
  await expect(login.errorBanner).toBeVisible();
  await expect(login.formContainer).toBeVisible();

  // -- unauthenticated redirect --
  await page.goto(`${BASE}/dashboard`);
  await expect(page).toHaveURL(`${BASE}/login`);
  await page.goto(`${BASE}/inventory`);
  await expect(page).toHaveURL(`${BASE}/login`);
  await page.goto(`${BASE}/reports`);
  await expect(page).toHaveURL(`${BASE}/login`);

  // -- valid credentials --
  const dashboard = new DashboardPage(page);
  await login.loginAs(USER, PASS);
  await expect(page).toHaveURL(`${BASE}/dashboard`);
  await expect(dashboard.nav.dashboardLink).toBeVisible();

  // -- logout and re-access blocked --
  await dashboard.nav.logout();
  await expect(page).toHaveURL(`${BASE}/login`);
  await page.goto(`${BASE}/dashboard`);
  await expect(page).toHaveURL(`${BASE}/login`);
});

// ─── Flow 3: Dashboard ───────────────────────────────────────────────────────
test('Flow 3: Dashboard', async ({ page }) => {
  const login = new LoginPage(page);
  await login.loginAs(USER, PASS);

  const dashboard = new DashboardPage(page);

  // -- page title --
  await expect(dashboard.pageTitle).toHaveText('Dashboard');

  // -- all 4 KPI cards visible --
  await expect(dashboard.kpiTotalItems).toBeVisible();
  await expect(dashboard.kpiLowStock).toBeVisible();
  await expect(dashboard.kpiOutOfStock).toBeVisible();
  await expect(dashboard.kpiInventoryValue).toBeVisible();

  // -- KPI values --
  await expect(dashboard.valueTotalItems).toHaveText('10');
  await expect(dashboard.valueLowStock).toHaveText('2');
  await expect(dashboard.valueOutOfStock).toHaveText('2');

  // -- recent items table --
  await expect(dashboard.recentRows()).toHaveCount(5);

  // -- nav links --
  await expect(dashboard.nav.dashboardLink).toBeVisible();
  await expect(dashboard.nav.inventoryLink).toBeVisible();
  await expect(dashboard.nav.reportsLink).toBeVisible();

  // -- nav navigates correctly --
  await dashboard.nav.goToInventory();
  await expect(page).toHaveURL(`${BASE}/inventory`);

  await page.goBack();
  await dashboard.nav.goToReports();
  await expect(page).toHaveURL(`${BASE}/reports`);
});

// ─── Flow 4: Inventory ───────────────────────────────────────────────────────
test('Flow 4: Inventory', async ({ page }) => {
  const login = new LoginPage(page);
  await login.loginAs(USER, PASS);

  const inventory = new InventoryPage(page);
  await inventory.nav.goToInventory();
  await expect(page).toHaveURL(`${BASE}/inventory`);

  // -- page title --
  await expect(inventory.pageTitle).toHaveText('Inventory');

  // -- row count --
  await expect(inventory.rows()).toHaveCount(10);

  // -- first and last SKU --
  await expect(inventory.firstRow().locator('[data-testid="sku"]')).toHaveText('PRD-001');
  await expect(inventory.lastRow().locator('[data-testid="sku"]')).toHaveText('PRD-010');

  // -- all 10 SKUs present --
  for (let i = 1; i <= 10; i++) {
    const sku = `PRD-${String(i).padStart(3, '0')}`;
    await expect(inventory.rowBySku(sku)).toBeVisible();
  }

  // -- badges and headers --
  await expect(inventory.statusBadges()).toHaveCount(10);
  await expect(inventory.headers()).toHaveCount(7); // SKU, Name, Category, Qty, Price, Status, Actions
});

// ─── Flow 5: Reports ─────────────────────────────────────────────────────────
test('Flow 5: Reports', async ({ page }) => {
  const login = new LoginPage(page);
  await login.loginAs(USER, PASS);

  const reports = new ReportsPage(page);
  await reports.nav.goToReports();
  await expect(page).toHaveURL(`${BASE}/reports`);

  // -- page title --
  await expect(reports.pageTitle).toHaveText('Reports');

  // -- both report cards visible --
  await expect(reports.categoryReport).toBeVisible();
  await expect(reports.statusReport).toBeVisible();

  // -- category report has data --
  const catCount = await reports.categoryRows().count();
  expect(catCount).toBeGreaterThan(0);

  // -- status report: exactly 3 rows --
  await expect(reports.statusRows()).toHaveCount(3);

  // -- all 3 statuses present --
  await expect(reports.statusTbody).toContainText('in stock');
  await expect(reports.statusTbody).toContainText('low stock');
  await expect(reports.statusTbody).toContainText('out of stock');

  // -- every status count is non-zero --
  for (const cell of await reports.statusCounts().all()) {
    const text = await cell.textContent();
    expect(Number(text?.trim())).toBeGreaterThan(0);
  }
});

// ─── Flow 6: CRUD Operations ─────────────────────────────────────────────────
test('Flow 6: CRUD Operations', async ({ page }) => {
  const TEST_SKU = 'TST-001';

  const login     = new LoginPage(page);
  const inventory = new InventoryPage(page);
  const form      = new InventoryFormPage(page);

  await login.loginAs(USER, PASS);
  await inventory.nav.goToInventory();

  // Clean up from any prior failed run
  if (await inventory.rowBySku(TEST_SKU).isVisible().catch(() => false)) {
    await inventory.deleteBtn(TEST_SKU).click();
    await page.waitForURL(`${BASE}/inventory`);
  }

  // ── CREATE ──────────────────────────────────────────────────────────────────
  await inventory.newItemButton.click();
  await expect(page).toHaveURL(`${BASE}/inventory/new`);
  await expect(form.pageTitle).toHaveText('New Item');

  await form.fill({ sku: TEST_SKU, name: 'Test Product', category: 'Testing', qty: '50', price: '99.99', status: 'in-stock' });
  await form.submit();
  await expect(page).toHaveURL(`${BASE}/inventory`);

  // Verify new row appears
  await expect(inventory.rowBySku(TEST_SKU)).toBeVisible();
  await expect(inventory.rowBySku(TEST_SKU).locator('[data-testid="name"]')).toHaveText('Test Product');
  await expect(inventory.rowBySku(TEST_SKU).locator('[data-testid="qty"]')).toHaveText('50');

  // Duplicate SKU should show error
  await inventory.newItemButton.click();
  await form.fill({ sku: TEST_SKU, name: 'Duplicate', category: 'X', qty: '1', price: '1' });
  await form.submit();
  await expect(form.errorBanner).toBeVisible();
  await page.goto(`${BASE}/inventory`);

  // ── EDIT ────────────────────────────────────────────────────────────────────
  await inventory.editBtn(TEST_SKU).click();
  await expect(page).toHaveURL(/\/inventory\/\d+\/edit/);
  await expect(form.pageTitle).toHaveText('Edit Item');

  // Verify form is pre-filled with current values
  await expect(form.skuInput).toHaveValue(TEST_SKU);
  await expect(form.nameInput).toHaveValue('Test Product');

  // Update name, qty and status
  await form.fill({ name: 'Test Product Updated', qty: '75', status: 'low-stock' });
  await form.submit();
  await expect(page).toHaveURL(`${BASE}/inventory`);

  await expect(inventory.rowBySku(TEST_SKU).locator('[data-testid="name"]')).toHaveText('Test Product Updated');
  await expect(inventory.rowBySku(TEST_SKU).locator('[data-testid="qty"]')).toHaveText('75');
  await expect(inventory.rowBySku(TEST_SKU).locator('[data-testid="status"] .badge')).toContainText('low stock');

  // ── DELETE ──────────────────────────────────────────────────────────────────
  const countBefore = await inventory.rows().count();
  await inventory.deleteBtn(TEST_SKU).click();
  await expect(page).toHaveURL(`${BASE}/inventory`);

  await expect(inventory.rowBySku(TEST_SKU)).not.toBeVisible();
  await expect(inventory.rows()).toHaveCount(countBefore - 1);
});

// ─── Flow 7: Long enterprise workflow (>3 min) ───────────────────────────
test('Flow 7: Long workflow (CRUD + concurrency + audit + background jobs)', async ({ context }) => {
  // Single-tab end-to-end master flow. Keep bounded so it can’t hang forever.
  test.setTimeout(180_000);
  const TEST_SKU = 'TST-LONG-01';

  // Single tab/page for the entire flow.
  const pageA = await context.newPage();

  const loginA = new LoginPage(pageA);
  const invA   = new InventoryPage(pageA);
  const formA  = new InventoryFormPage(pageA);
  const dashboardA = new DashboardPage(pageA);
  const reportsA   = new ReportsPage(pageA);

  // Login once (shared session)
  await loginA.loginAs(USER, PASS);

  // ── Tab validations: Dashboard ↔ API stats/inventory ────────────────────────
  await expect(pageA).toHaveURL(`${BASE}/dashboard`);
  await expect(dashboardA.pageTitle).toHaveText('Dashboard');

  // Main nav tabs visible
  await expect(pageA.getByTestId('main-nav')).toBeVisible();
  await expect(pageA.getByTestId('nav-dashboard')).toBeVisible();
  await expect(pageA.getByTestId('nav-inventory')).toBeVisible();
  await expect(pageA.getByTestId('nav-reports')).toBeVisible();
  await expect(pageA.getByTestId('nav-audit')).toBeVisible();
  await expect(pageA.getByTestId('nav-jobs')).toBeVisible();

  // API → UI dependency: KPIs match /api/stats
  const statsRes0 = await pageA.request.get(`${BASE}/api/stats`);
  expect(statsRes0.status()).toBe(200);
  const stats0 = await statsRes0.json();
  await expect(dashboardA.valueTotalItems).toHaveText(String(stats0.totalItems));
  await expect(dashboardA.valueLowStock).toHaveText(String(stats0.lowStock));
  await expect(dashboardA.valueOutOfStock).toHaveText(String(stats0.outOfStock));

  // Recent table dependency: shows exactly 5 rows
  await expect(dashboardA.recentRows()).toHaveCount(5);

  // ── Tab validations: Reports ↔ API stats ────────────────────────────────────
  await pageA.getByTestId('nav-reports').click();
  await expect(pageA).toHaveURL(`${BASE}/reports`);
  await expect(reportsA.pageTitle).toHaveText('Reports');
  await expect(reportsA.categoryReport).toBeVisible();
  await expect(reportsA.statusReport).toBeVisible();
  await expect(reportsA.statusRows()).toHaveCount(3);

  // Status counts in UI should sum to total items from API
  const statusCounts = await reportsA.statusCounts().allTextContents();
  const sum = statusCounts.map(t => Number((t || '').trim())).reduce((a, b) => a + b, 0);
  expect(sum).toBe(stats0.totalItems);

  // ── Tab validations: Inventory ↔ API inventory ──────────────────────────────
  await pageA.getByTestId('nav-inventory').click();
  await expect(pageA).toHaveURL(`${BASE}/inventory`);

  // Cleanup from any prior run
  if (await invA.rowBySku(TEST_SKU).isVisible().catch(() => false)) {
    await invA.deleteBtn(TEST_SKU).click();
    await pageA.waitForURL(`${BASE}/inventory`);
  }

  // ── CRUD: create → validate → edit → delete protection (kept clean) ─────────
  await invA.newItemButton.click();
  await expect(pageA).toHaveURL(`${BASE}/inventory/new`);
  await formA.fill({ sku: TEST_SKU, name: 'Long Workflow Item', category: 'Testing', qty: '10', price: '5.00', status: 'in-stock' });
  await formA.submit();
  await expect(pageA).toHaveURL(`${BASE}/inventory`);
  await expect(invA.rowBySku(TEST_SKU)).toBeVisible();

  // Dependency check: API reflects created item
  {
    const res = await pageA.request.get(`${BASE}/api/inventory`);
    expect(res.status()).toBe(200);
    const items = await res.json();
    expect(items.some((i: any) => i?.sku === TEST_SKU && i?.name === 'Long Workflow Item')).toBe(true);
  }

  // Duplicate SKU should show error (complex validation branch)
  await invA.newItemButton.click();
  await formA.fill({ sku: TEST_SKU, name: 'Duplicate', category: 'X', qty: '1', price: '1' });
  await formA.submit();
  await expect(formA.errorBanner).toBeVisible();
  await pageA.goto(`${BASE}/inventory`);

  // Open edit form and capture current version (to simulate a stale submission)
  await invA.editBtn(TEST_SKU).click();
  await expect(pageA).toHaveURL(/\/inventory\/\d+\/edit/);

  const editUrl = pageA.url();
  const idMatch = /\/inventory\/(\d+)\/edit/.exec(editUrl);
  expect(idMatch?.[1]).toBeTruthy();
  const itemId = idMatch![1];
  const staleVersion = (await pageA.getByTestId('input-version').inputValue()).trim();
  expect(staleVersion).toMatch(/^\d+$/);

  // First edit saves successfully (bumps version)
  await formA.fill({ qty: '11', status: 'low-stock', name: 'Long Workflow Updated A' });
  await formA.submit();
  await expect(pageA).toHaveURL(`${BASE}/inventory`);
  await expect(invA.rowBySku(TEST_SKU).locator('[data-testid="qty"]')).toHaveText('11');
  await expect(invA.rowBySku(TEST_SKU).locator('[data-testid="status"] .badge')).toContainText('low stock');

  // Dependency check: stats endpoint is consistent after update
  {
    const statsRes = await pageA.request.get(`${BASE}/api/stats`);
    expect(statsRes.status()).toBe(200);
    const stats = await statsRes.json();
    expect(stats.totalItems).toBeGreaterThanOrEqual(10);
    expect(stats.inStock + stats.lowStock + stats.outOfStock).toBe(stats.totalItems);
  }

  // Simulate an external update (same session) to bump version behind the scenes.
  // Grab the latest version from the API so we don't rely on assumptions.
  const latestRes = await pageA.request.get(`${BASE}/api/inventory/${itemId}`);
  expect(latestRes.status()).toBe(200);
  const latest = await latestRes.json();
  expect(String(latest.id)).toBe(String(itemId));
  expect(latest.sku).toBe(TEST_SKU);
  expect(String(latest.version || '')).toMatch(/^\d+$/);

  await pageA.request.post(`${BASE}/inventory/${itemId}/edit`, {
    form: {
      sku: TEST_SKU,
      name: 'External Update',
      category: 'Testing',
      qty: '13',
      price: '5.00',
      status: 'in-stock',
      version: String(latest.version), // must match current version
    },
  });

  await pageA.goto(`${BASE}/inventory/${itemId}/edit`);
  await expect(pageA).toHaveURL(/\/inventory\/\d+\/edit/);
  // Force stale version submit by sending the old version value
  // Hidden field, so bypass visibility constraints by setting value via evaluate().
  await pageA.getByTestId('input-version').evaluate((el, v) => {
    (el as any).value = v;
  }, staleVersion);
  await formA.fill({ qty: '12', name: 'Long Workflow Updated B' });
  await formA.submit();
  await expect(formA.errorBanner).toBeVisible();
  await expect(formA.errorBanner).toContainText('updated by someone else');

  // Dependency check: stale update did NOT overwrite the external update
  await pageA.goto(`${BASE}/inventory`);
  await expect(invA.rowBySku(TEST_SKU).locator('[data-testid="qty"]')).toHaveText('13');

  // ── Background jobs (reconcile ~1m default) ─────────────────────────────────
  await pageA.goto(`${BASE}/jobs`);
  await expect(pageA.getByTestId('page-title')).toHaveText('Jobs');
  await pageA.getByTestId('btn-start-reconcile').click();
  await expect(pageA.getByTestId('job-status')).toHaveText(/running|completed/);

  // Poll until reconcile completes using API (more reliable than DOM polling)
  await expect(pageA.getByTestId('job-id')).not.toHaveText('—');
  const jobId = (await pageA.getByTestId('job-id').textContent())?.trim();
  expect(jobId).toMatch(/^\d+$/);
  await expect
    .poll(async () => {
      const r = await pageA.request.get(`${BASE}/api/jobs/${jobId}`);
      if (!r.ok()) return 'unknown';
      const j = await r.json();
      return String(j.status || '').trim();
    }, { timeout: 120_000, intervals: [1500, 1500, 2000, 2500, 3000] })
    .toBe('completed');

  await expect(pageA.getByTestId('job-progress')).toHaveText('100%');

  // Start a backup job (expected to fail) and verify error surfaced
  await pageA.getByTestId('btn-start-backup').click();
  await expect(pageA.getByTestId('job-status')).toHaveText(/running|failed/);
  await expect(pageA.getByTestId('job-id')).not.toHaveText('—');
  await expect(pageA.getByTestId('job-id')).not.toHaveText(jobId || '');
  const backupId = (await pageA.getByTestId('job-id').textContent())?.trim();
  expect(backupId).toMatch(/^\d+$/);

  await expect
    .poll(async () => {
      const r = await pageA.request.get(`${BASE}/api/jobs/${backupId}`);
      if (!r.ok()) return 'unknown';
      const j = await r.json();
      return String(j.status || '').trim();
    }, { timeout: 90_000, intervals: [1500, 1500, 2000, 2500, 3000] })
    .toBe('failed');

  await expect(pageA.getByTestId('job-error')).toBeVisible();
  await expect(pageA.getByTestId('job-error')).toContainText('Simulated failure');

  // Start reconcile again and cancel it
  await pageA.getByTestId('btn-start-reconcile').click();
  await expect(pageA.getByTestId('job-id')).not.toHaveText('—');
  await expect(pageA.getByTestId('job-id')).not.toHaveText(backupId || '');
  const cancelId = (await pageA.getByTestId('job-id').textContent())?.trim();
  expect(cancelId).toMatch(/^\d+$/);
  await pageA.getByTestId('btn-cancel-job').click();

  await expect
    .poll(async () => {
      const r = await pageA.request.get(`${BASE}/api/jobs/${cancelId}`);
      if (!r.ok()) return 'unknown';
      const j = await r.json();
      return String(j.status || '').trim();
    }, { timeout: 30_000, intervals: [800, 1000, 1500] })
    .toBe('cancelled');

  // ── Verify audit page includes create + update + job actions and IDs ────────
  await pageA.goto(`${BASE}/audit`);
  await expect(pageA.getByTestId('page-title')).toHaveText('Audit Log');
  const auditTable = pageA.getByTestId('audit-tbody');
  await expect(auditTable).toContainText('CREATE_ITEM');
  await expect(auditTable).toContainText('UPDATE_ITEM');
  await expect(auditTable).toContainText('START_JOB');
  await expect(auditTable).toContainText('COMPLETE_JOB');
  await expect(auditTable).toContainText('FAIL_JOB');
  await expect(auditTable).toContainText('CANCEL_JOB');
  await expect(auditTable).toContainText(TEST_SKU);

  // Completed reconcile job appears with its id
  await expect(auditTable).toContainText(`JOB=reconcile id=${jobId}`);
  // Failed backup job appears with its id and error
  await expect(auditTable).toContainText(`JOB=backup id=${backupId}`);
  await expect(auditTable).toContainText('Simulated failure: upstream storage unavailable');
  // Cancelled reconcile job appears with its id
  await expect(auditTable).toContainText(`JOB=reconcile id=${cancelId}`);

  // Dependency check: audit API includes job completion
  {
    const auditRes = await pageA.request.get(`${BASE}/api/audit`);
    expect(auditRes.status()).toBe(200);
    const events = await auditRes.json();
    expect(Array.isArray(events)).toBe(true);
    expect(events.some((e: any) => e?.action === 'COMPLETE_JOB')).toBe(true);
    expect(events.some((e: any) => e?.action === 'FAIL_JOB')).toBe(true);
    expect(events.some((e: any) => e?.action === 'CANCEL_JOB')).toBe(true);
  }

  // Cleanup item to avoid polluting subsequent runs
  await pageA.goto(`${BASE}/inventory`);
  await invA.deleteBtn(TEST_SKU).click();
  await expect(pageA).toHaveURL(`${BASE}/inventory`);

  // Final dependency check: item removed from API list
  {
    const res = await pageA.request.get(`${BASE}/api/inventory`);
    expect(res.status()).toBe(200);
    const items = await res.json();
    expect(items.some((i: any) => i?.sku === TEST_SKU)).toBe(false);
  }
});
