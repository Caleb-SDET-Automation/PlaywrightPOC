import type { Page, Locator } from '@playwright/test';
import { NavBar } from './NavBar';

/**
 * Inventory list page — /inventory
 */
export class InventoryPage {
  readonly nav:          NavBar;
  readonly pageTitle:    Locator;
  readonly table:        Locator;
  readonly tbody:        Locator;
  readonly newItemButton: Locator;

  constructor(readonly page: Page) {
    this.nav           = new NavBar(page);
    this.pageTitle     = page.locator('[data-testid="page-title"]');
    this.table         = page.locator('[data-testid="inventory-table"]');
    this.tbody         = page.locator('[data-testid="inventory-tbody"]');
    this.newItemButton = page.locator('[data-testid="btn-new-item"]');
  }

  rows()         { return this.tbody.locator('[data-testid="inventory-row"]'); }
  rowBySku(sku: string) { return this.tbody.locator(`[data-sku="${sku}"]`); }
  firstRow()     { return this.rows().first(); }
  lastRow()      { return this.rows().last(); }
  headers()      { return this.table.locator('th'); }
  statusBadges() { return this.rows().locator('.badge'); }

  /** Edit button inside a specific SKU row. */
  editBtn(sku: string) { return this.rowBySku(sku).locator('[data-testid="btn-edit"]'); }

  /** Delete button inside a specific SKU row. */
  deleteBtn(sku: string) { return this.rowBySku(sku).locator('[data-testid="btn-delete"]'); }
}
