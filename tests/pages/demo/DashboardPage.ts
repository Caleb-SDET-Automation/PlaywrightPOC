import type { Page, Locator } from '@playwright/test';
import { NavBar } from './NavBar';

/**
 * Dashboard page — /dashboard
 * KPI cards: Total Items · Low Stock · Out of Stock · Inventory Value
 * Recent Items table showing the first 5 inventory rows.
 */
export class DashboardPage {
  readonly nav: NavBar;

  readonly pageTitle:          Locator;

  // KPI card containers
  readonly kpiTotalItems:      Locator;
  readonly kpiLowStock:        Locator;
  readonly kpiOutOfStock:      Locator;
  readonly kpiInventoryValue:  Locator;

  // KPI value text nodes
  readonly valueTotalItems:    Locator;
  readonly valueLowStock:      Locator;
  readonly valueOutOfStock:    Locator;
  readonly valueInventory:     Locator;

  // Recent items table
  readonly recentItemsTable:   Locator;
  readonly recentItemsBody:    Locator;

  constructor(readonly page: Page) {
    this.nav = new NavBar(page);

    this.pageTitle          = page.locator('[data-testid="page-title"]');

    this.kpiTotalItems      = page.locator('[data-testid="kpi-total-items"]');
    this.kpiLowStock        = page.locator('[data-testid="kpi-low-stock"]');
    this.kpiOutOfStock      = page.locator('[data-testid="kpi-out-of-stock"]');
    this.kpiInventoryValue  = page.locator('[data-testid="kpi-inventory-value"]');

    this.valueTotalItems    = page.locator('[data-testid="kpi-value-total-items"]');
    this.valueLowStock      = page.locator('[data-testid="kpi-value-low-stock"]');
    this.valueOutOfStock    = page.locator('[data-testid="kpi-value-out-of-stock"]');
    this.valueInventory     = page.locator('[data-testid="kpi-value-inventory"]');

    this.recentItemsTable   = page.locator('[data-testid="recent-items-table"]');
    this.recentItemsBody    = page.locator('[data-testid="recent-items-body"]');
  }

  /** All rows in the Recent Items table. */
  recentRows() {
    return this.recentItemsBody.locator('[data-testid="recent-row"]');
  }
}
