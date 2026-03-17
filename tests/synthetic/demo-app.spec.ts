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

// ─── Flow 0: API Validation ──────────────────────────────────────────────────
test('Flow 0: API Validation', async ({ request }) => {
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

// ─── Flow 1: Login ───────────────────────────────────────────────────────────
test('Flow 1: Login', async ({ page }) => {
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

// ─── Flow 2: Dashboard ───────────────────────────────────────────────────────
test('Flow 2: Dashboard', async ({ page }) => {
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

// ─── Flow 3: Inventory ───────────────────────────────────────────────────────
test('Flow 3: Inventory', async ({ page }) => {
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

// ─── Flow 4: Reports ─────────────────────────────────────────────────────────
test('Flow 4: Reports', async ({ page }) => {
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

// ─── Flow 5: CRUD Operations ─────────────────────────────────────────────────
test('Flow 5: CRUD Operations', async ({ page }) => {
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
