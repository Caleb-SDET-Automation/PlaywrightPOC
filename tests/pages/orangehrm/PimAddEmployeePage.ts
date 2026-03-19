import { expect, type Locator, type Page } from '@playwright/test';

export class PimAddEmployeePage {
  readonly heading: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly saveButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: /add employee/i });
    this.firstNameInput = page.getByPlaceholder('First Name');
    this.lastNameInput = page.getByPlaceholder('Last Name');
    this.saveButton = page.getByRole('button', { name: /save/i });
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/web\/index\.php\/pim\/addEmployee/);
    await expect(this.heading).toBeVisible();
  }

  async createEmployee(firstName: string, lastName: string) {
    await this.expectLoaded();
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.saveButton.click();
  }
}

