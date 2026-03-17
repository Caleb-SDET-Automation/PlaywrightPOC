import type { Page, Locator } from '@playwright/test';

/**
 * Shared navigation bar present on all authenticated pages.
 */
export class NavBar {
  readonly dashboardLink: Locator;
  readonly inventoryLink: Locator;
  readonly reportsLink:   Locator;
  readonly logoutButton:  Locator;
  readonly userLabel:     Locator;

  constructor(private readonly page: Page) {
    this.dashboardLink = page.locator('[data-testid="nav-dashboard"]');
    this.inventoryLink = page.locator('[data-testid="nav-inventory"]');
    this.reportsLink   = page.locator('[data-testid="nav-reports"]');
    this.logoutButton  = page.locator('[data-testid="nav-logout"]');
    this.userLabel     = page.locator('[data-testid="nav-user"]');
  }

  async goToDashboard() { await this.dashboardLink.click(); }
  async goToInventory()  { await this.inventoryLink.click(); }
  async goToReports()    { await this.reportsLink.click(); }
  async logout()         { await this.logoutButton.click(); }
}
