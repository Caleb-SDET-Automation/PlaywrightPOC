import { expect, type Locator, type Page } from '@playwright/test';

export class OrangeHrmSidePanel {
  readonly root: Locator;
  readonly dashboardLink: Locator;
  readonly pimLink: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByRole('navigation', { name: /sidepanel/i });
    this.dashboardLink = page.getByRole('link', { name: /^dashboard$/i });
    this.pimLink = page.getByRole('link', { name: /^pim$/i });
  }

  async expectVisible() {
    await expect(this.root).toBeVisible();
  }

  async goToPim() {
    await this.pimLink.click();
  }
}

export class OrangeHrmTopBar {
  readonly userDropdownTab: Locator;
  readonly logoutMenuItem: Locator;

  constructor(private readonly page: Page) {
    this.userDropdownTab = page.locator('.oxd-userdropdown-tab');
    this.logoutMenuItem = page.getByRole('menuitem', { name: /logout/i });
  }

  async logout() {
    await this.userDropdownTab.click();
    await this.logoutMenuItem.click();
  }
}

