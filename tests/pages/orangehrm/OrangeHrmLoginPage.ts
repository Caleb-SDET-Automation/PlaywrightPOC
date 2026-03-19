import { expect, type Locator, type Page } from '@playwright/test';
import { ORANGEHRM_BASE } from './config';

export class OrangeHrmLoginPage {
  readonly heading: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly invalidCredentialsText: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: /login/i });
    this.usernameInput = page.getByPlaceholder('Username');
    this.passwordInput = page.getByPlaceholder('Password');
    this.loginButton = page.getByRole('button', { name: /login/i });
    this.invalidCredentialsText = page.getByText(/invalid credentials/i);
  }

  get url() {
    return `${ORANGEHRM_BASE}/web/index.php/auth/login`;
  }

  async goto() {
    await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
    await expect(this.heading).toBeVisible();
  }

  async login(username: string, password: string) {
    await this.goto();
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}

