import type { Page, Locator } from '@playwright/test';
import { NavBar } from './NavBar';

/**
 * Reports page — /reports
 * Two side-by-side report cards:
 *   - Category Report: groups items by product category
 *   - Status Report: in-stock / low-stock / out-of-stock breakdown
 */
export class ReportsPage {
  readonly nav:            NavBar;
  readonly pageTitle:      Locator;
  readonly categoryReport: Locator;
  readonly statusReport:   Locator;
  readonly categoryTbody:  Locator;
  readonly statusTbody:    Locator;

  constructor(readonly page: Page) {
    this.nav            = new NavBar(page);
    this.pageTitle      = page.locator('[data-testid="page-title"]');
    this.categoryReport = page.locator('[data-testid="category-report"]');
    this.statusReport   = page.locator('[data-testid="status-report"]');
    this.categoryTbody  = page.locator('[data-testid="category-tbody"]');
    this.statusTbody    = page.locator('[data-testid="status-tbody"]');
  }

  categoryRows() { return this.categoryTbody.locator('[data-testid="category-row"]'); }
  statusRows()   { return this.statusTbody.locator('[data-testid="status-row"]'); }

  /** Count cells inside the status table (used for non-zero assertions). */
  statusCounts() { return this.statusTbody.locator('[data-testid="status-count"]'); }
}
