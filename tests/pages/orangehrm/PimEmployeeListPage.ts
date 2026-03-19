import { expect, type Locator, type Page } from '@playwright/test';
import { ORANGEHRM_BASE } from './config';

export class PimEmployeeListPage {
  readonly heading: Locator;
  readonly addButton: Locator;
  readonly employeeNameInput: Locator;
  readonly searchButton: Locator;
  readonly resultsTable: Locator;
  readonly confirmDeleteButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: /pim/i });
    this.addButton = page.getByRole('button', { name: /add/i });
    this.employeeNameInput = page.getByPlaceholder('Type for hints...').first();
    this.searchButton = page.getByRole('button', { name: /search/i });
    this.resultsTable = page.locator('.oxd-table');
    this.confirmDeleteButton = page.getByRole('button', { name: /yes, delete/i });
  }

  get url() {
    return `${ORANGEHRM_BASE}/web/index.php/pim/viewEmployeeList`;
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/web\/index\.php\/pim\/viewEmployeeList/);
    await expect(this.heading).toBeVisible();
  }

  async goto() {
    await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
    await this.expectLoaded();
  }

  async clickAdd() {
    await this.addButton.click();
  }

  async searchByFullName(fullName: string) {
    await this.employeeNameInput.fill(fullName);
    await this.searchButton.click();
    await expect(this.resultsTable).toBeVisible();
  }

  rowByName(firstName: string, lastName: string) {
    return this.page
      .locator('.oxd-table-body .oxd-table-card')
      .filter({ hasText: firstName })
      .filter({ hasText: lastName })
      .first();
  }

  async deleteEmployee(firstName: string, lastName: string) {
    const row = this.rowByName(firstName, lastName);
    await expect(row).toBeVisible();
    await row.locator('button').filter({ has: this.page.locator('i.bi-trash') }).first().click();
    await this.confirmDeleteButton.click();
  }
}

