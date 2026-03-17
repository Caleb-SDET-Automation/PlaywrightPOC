/**
 * Authentication Setup
 * Runs once before all synthetic tests to obtain and persist session state.
 */
import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_FILE = '.auth/state.json';

setup('authenticate', async ({ page }) => {
  const baseUrl   = process.env.BASE_URL   || 'https://erp.example.com';
  const username  = process.env.ERP_USERNAME || 'monitor_user';
  const password  = process.env.ERP_PASSWORD || 'changeme';
  const loginPath = process.env.LOGIN_PATH  || '/Account/Login';

  const preflightPath = process.env.LOGIN_PREFLIGHT_URL || '';

  // Always start fresh
  await page.context().clearCookies();

  if (preflightPath) {
    // Sites like Dolibarr demo sit behind Cloudflare, which blocks headless
    // Chromium via TLS fingerprinting — page.goto() hangs indefinitely.
    // page.request uses Node.js HTTP (not Chromium's TLS stack) and is not blocked.
    // It also shares the same cookie jar as page.context(), so storageState()
    // will capture the authenticated session after all API calls complete.

    const preflightUrl = `${baseUrl}${preflightPath}`;

    // Step 1 — fetch the profile-selector page to get the first CSRF token
    const preflightRes = await page.request.get(preflightUrl);
    const preflightHtml = await preflightRes.text();
    const csrfToken1 =
      preflightHtml.match(/name="token"\s*value="([^"]+)"/)?.[1] ||
      preflightHtml.match(/name="anti-csrf-newtoken"\s*content="([^"]+)"/)?.[1] ||
      '';

    // Step 2 — POST the profile form with the required Referer.
    //           The server redirects (302) to the login page; page.request
    //           follows the redirect automatically, so formRes is the login page.
    const formRes = await page.request.post(`${baseUrl}/public/demo/index.php`, {
      form: {
        action:   'gotodemo',
        token:    csrfToken1,
        username,
        urlfrom:  '/public/demo/index.php',
      },
      headers: { 'Referer': preflightUrl },
    });

    const loginPageHtml = await formRes.text();
    const loginPageUrl  = formRes.url();
    const csrfToken2    =
      loginPageHtml.match(/name="token"\s*value="([^"]+)"/)?.[1] || '';

    // Step 3 — POST credentials to the login page
    await page.request.post(loginPageUrl, {
      form: {
        token:                    csrfToken2,
        actionlogin:              'login',
        loginfunction:            'loginfunction',
        backtopage:               '',
        tz:                       '',
        tz_string:                '',
        dst_observed:             '',
        dst_first:                '',
        dst_second:               '',
        screenwidth:              '1280',
        screenheight:             '720',
        dol_hide_topmenu:         '0',
        dol_hide_leftmenu:        '0',
        dol_optimize_smallscreen: '0',
        dol_no_mouse_hover:       '0',
        dol_use_jmobile:          '0',
        username,
        password,
      },
      headers: { 'Referer': loginPageUrl },
    });

    // page.context() cookies are now authenticated — fall through to storageState()

  } else {
    // Standard browser-based auth for sites not behind aggressive bot protection.
    // Use 'commit' so goto() returns on first-byte (avoids blocking on heavy JS).
    await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'commit' });

    // Wait for the login form to appear (HTML is parsed well before JS runs)
    await page.waitForSelector(
      'input[name="username"], input[name="UserName"], #username, input[autocomplete="username"]',
      { state: 'attached', timeout: 30_000 }
    );

    await page.locator(
      'input[name="username"], input[name="UserName"], #username, #UserName, [data-testid="username"], input[autocomplete="username"]'
    ).first().fill(username);

    await page.locator(
      'input[name="password"], input[name="Password"], #password, #Password, [data-testid="password"], input[type="password"]'
    ).first().fill(password);

    await page.locator(
      'button[type="submit"], input[type="submit"], [data-testid="login-btn"], .orangehrm-login-button'
    ).first().click();

    // Wait for successful navigation away from the login page
    const loginUrl = `${baseUrl}${loginPath}`;
    await page.waitForURL(
      url => url.href !== loginUrl && !url.href.startsWith(loginUrl),
      { timeout: 20_000 }
    );
  }

  // Ensure auth directory exists and persist cookies/storage
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });

  console.log(`[AUTH] Session stored for site: ${process.env.SITE_ID || 'default'}`);
});
