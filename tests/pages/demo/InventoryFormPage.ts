import type { Page, Locator } from '@playwright/test';
import { NavBar } from './NavBar';

/**
 * Inventory form page — shared for create (/inventory/new) and edit (/inventory/:id/edit).
 */
export class InventoryFormPage {
  readonly nav:           NavBar;
  readonly pageTitle:     Locator;
  readonly skuInput:      Locator;
  readonly nameInput:     Locator;
  readonly categoryInput: Locator;
  readonly qtyInput:      Locator;
  readonly priceInput:    Locator;
  readonly statusSelect:  Locator;
  readonly submitButton:  Locator;
  readonly cancelLink:    Locator;
  readonly errorBanner:   Locator;

  constructor(readonly page: Page) {
    this.nav            = new NavBar(page);
    this.pageTitle      = page.locator('[data-testid="page-title"]');
    this.skuInput       = page.locator('[data-testid="input-sku"]');
    this.nameInput      = page.locator('[data-testid="input-name"]');
    this.categoryInput  = page.locator('[data-testid="input-category"]');
    this.qtyInput       = page.locator('[data-testid="input-qty"]');
    this.priceInput     = page.locator('[data-testid="input-price"]');
    this.statusSelect   = page.locator('[data-testid="input-status"]');
    this.submitButton   = page.locator('[data-testid="btn-submit"]');
    this.cancelLink     = page.locator('[data-testid="btn-cancel"]');
    this.errorBanner    = page.locator('[data-testid="form-error"]');
  }

  /**
   * Fill only the fields that are provided (undefined fields are left untouched).
   * Useful for partial edits.
   */
  async fill(data: {
    sku?:      string;
    name?:     string;
    category?: string;
    qty?:      string;
    price?:    string;
    status?:   string;
  }) {
    if (data.sku      !== undefined) await this.skuInput.fill(data.sku);
    if (data.name     !== undefined) await this.nameInput.fill(data.name);
    if (data.category !== undefined) await this.categoryInput.fill(data.category);
    if (data.qty      !== undefined) await this.qtyInput.fill(data.qty);
    if (data.price    !== undefined) await this.priceInput.fill(data.price);
    if (data.status   !== undefined) await this.statusSelect.selectOption(data.status);
  }

  async submit() { await this.submitButton.click(); }
}
