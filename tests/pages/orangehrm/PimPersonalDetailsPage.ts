import { expect, type Locator, type Page } from '@playwright/test';

export class PimPersonalDetailsPage {
  readonly heading: Locator;
  readonly fullNameHeading: (fullNameRegex: RegExp) => Locator;
  readonly firstNameInput: Locator;
  readonly saveButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: /personal details/i });
    this.fullNameHeading = (fullNameRegex: RegExp) => page.getByRole('heading', { name: fullNameRegex });
    this.firstNameInput = page.getByPlaceholder('First Name');
    this.saveButton = page.getByRole('button', { name: /^save$/i }).first();
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/web\/index\.php\/pim\/viewPersonalDetails/);
    await expect(this.heading).toBeVisible();
  }

  async expectFullName(firstName: string, lastName: string) {
    const re = new RegExp(`${firstName}\\s+${lastName}`, 'i');
    await expect(this.fullNameHeading(re)).toBeVisible();
  }

  async updateFirstName(firstName: string): Promise<string> {
    const maxLengthAttr = await this.firstNameInput.getAttribute('maxlength');
    const maxLength = maxLengthAttr ? Number.parseInt(maxLengthAttr, 10) : undefined;
    const expected = Number.isFinite(maxLength) ? firstName.slice(0, maxLength) : firstName;

    await this.firstNameInput.fill(expected);
    await this.saveButton.click();
    await expect(this.firstNameInput).toHaveValue(expected);
    return await this.firstNameInput.inputValue();
  }
}

