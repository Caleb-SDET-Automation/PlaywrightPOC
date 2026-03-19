import { test, expect } from '@playwright/test';
import { ORANGEHRM_PASSWORD, ORANGEHRM_USERNAME } from '../pages/orangehrm/config';
import { OrangeHrmLoginPage } from '../pages/orangehrm/OrangeHrmLoginPage';
import { OrangeHrmSidePanel, OrangeHrmTopBar } from '../pages/orangehrm/OrangeHrmAppShell';
import { PimEmployeeListPage } from '../pages/orangehrm/PimEmployeeListPage';
import { PimAddEmployeePage } from '../pages/orangehrm/PimAddEmployeePage';
import { PimPersonalDetailsPage } from '../pages/orangehrm/PimPersonalDetailsPage';
import { createOrangeHrmEmployeeTestData } from '../test-data/orangehrm.data';

/**
 * OrangeHRM Demo — 4 flows
 *
 * Base URL default:
 *   https://opensource-demo.orangehrmlive.com
 *
 * Env overrides:
 *   ORANGEHRM_BASE_URL
 *   ORANGEHRM_USERNAME
 *   ORANGEHRM_PASSWORD
 */

// ─── Flow 1: Login page renders ───────────────────────────────────────────────
test('OrangeHRM Flow 1: Login page loads', async ({ page }) => {
  const login = new OrangeHrmLoginPage(page);
  await login.goto();
  await expect(login.usernameInput).toBeVisible();
  await expect(login.passwordInput).toBeVisible();
  await expect(login.loginButton).toBeVisible();
});

// ─── Flow 2: Invalid login shows error ────────────────────────────────────────
test('OrangeHRM Flow 2: Invalid login shows error', async ({ page }) => {
  const login = new OrangeHrmLoginPage(page);
  await login.login('wrong-user', 'wrong-pass');
  await expect(login.invalidCredentialsText).toBeVisible();
  await expect(page).toHaveURL(/\/web\/index\.php\/auth\/login/);
});

// ─── Flow 3: Valid login + basic dashboard validations ────────────────────────
test('OrangeHRM Flow 3: Login and dashboard visible', async ({ page }) => {
  const login = new OrangeHrmLoginPage(page);
  await login.login(ORANGEHRM_USERNAME, ORANGEHRM_PASSWORD);
  await expect(page).toHaveURL(/\/web\/index\.php\/dashboard\/index/);
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

  const sidePanel = new OrangeHrmSidePanel(page);
  await sidePanel.expectVisible();
  await expect(sidePanel.dashboardLink).toBeVisible();
  await expect(sidePanel.pimLink).toBeVisible();
});

// ─── Flow 4: CRUD Operations (PIM Employee) + logout ──────────────────────────
test('OrangeHRM Flow 4: CRUD employee and logout', async ({ page }) => {
  const login = new OrangeHrmLoginPage(page);
  await login.login(ORANGEHRM_USERNAME, ORANGEHRM_PASSWORD);
  await expect(page).toHaveURL(/\/web\/index\.php\/dashboard\/index/);

  const sidePanel = new OrangeHrmSidePanel(page);
  const list = new PimEmployeeListPage(page);
  const add = new PimAddEmployeePage(page);
  const details = new PimPersonalDetailsPage(page);
  const topBar = new OrangeHrmTopBar(page);

  // Navigate to PIM (Employee List)
  await sidePanel.goToPim();
  await list.expectLoaded();

  const { firstName, lastName, updatedFirstName } = createOrangeHrmEmployeeTestData();

  // Personal Details page
  await list.clickAdd();
  await add.createEmployee(firstName, lastName);
  await details.expectLoaded();
  await details.expectFullName(firstName, lastName);

  // ── UPDATE: edit a field (First Name) ───────────────────────────────────────
  // Use a stable field we know exists on Personal Details.
  const savedFirstName = await details.updateFirstName(updatedFirstName);

  // ── READ: verify in Employee List search ────────────────────────────────────
  await sidePanel.goToPim();
  await list.expectLoaded();
  await list.searchByFullName(`${savedFirstName} ${lastName}`);
  await expect(list.resultsTable).toContainText(savedFirstName);
  await expect(list.resultsTable).toContainText(lastName);

  // ── DELETE: remove the employee from list ───────────────────────────────────
  await list.deleteEmployee(savedFirstName, lastName);

  // Re-search to confirm it’s gone
  await list.searchByFullName(`${savedFirstName} ${lastName}`);
  await expect(list.resultsTable).not.toContainText(savedFirstName);
  await expect(list.resultsTable).not.toContainText(lastName);

  // Logout via user dropdown
  await topBar.logout();
  await expect(page).toHaveURL(/\/web\/index\.php\/auth\/login/);
});

