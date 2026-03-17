import type { Page, Locator } from '@playwright/test';

/**
 * Login page — /login
 */
export class LoginPage {
  readonly formContainer: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton:  Locator;
  readonly errorBanner:   Locator;

  private readonly base: string;

  constructor(private readonly page: Page) {
    this.base           = process.env.BASE_URL || 'http://localhost:3333';
    this.formContainer  = page.locator('[data-testid="login-form-container"]');
    this.usernameInput  = page.locator('[data-testid="username"]');
    this.passwordInput  = page.locator('[data-testid="password"]');
    this.submitButton   = page.locator('[data-testid="login-btn"]');
    this.errorBanner    = page.locator('[data-testid="login-error"]');
  }

  get url() { return `${this.base}/login`; }

  async goto() {
    await this.page.goto(this.url);
  }

  /** Fill the form and click submit — does NOT wait for redirect. */
  async submit(username: string, password: string) {
    await this.goto();
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /** Submit and wait for the dashboard redirect (asserts success). */
  async loginAs(username: string, password: string) {
    await this.submit(username, password);
    await this.page.waitForURL(`${this.base}/dashboard`);
  }
}
