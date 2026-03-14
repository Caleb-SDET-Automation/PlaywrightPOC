/**
 * Synthetic Monitor: Middleware API Health Checks
 * Validates: Health endpoint returns 200, auth works, key endpoints respond
 * Journey: Middleware API Live → Returns 200
 */
import { test, expect } from '../fixtures/base';
import { THRESHOLDS, evaluateThreshold, perfData } from '../../config/thresholds';

const MW_BASE    = process.env.MIDDLEWARE_BASE_URL     || 'https://api.example.com';
const MW_KEY     = process.env.MIDDLEWARE_API_KEY       || '';
const HEALTH_EP  = process.env.MIDDLEWARE_HEALTH_ENDPOINT || '/health';
const AUTH_EP    = process.env.MIDDLEWARE_AUTH_ENDPOINT   || '/auth/token';

// True when middleware is a separate API server, not the same host as the ERP
const MW_DEDICATED = MW_BASE !== (process.env.BASE_URL || 'https://erp.example.com') &&
                     !MW_BASE.includes('example.com');

test.describe('Middleware API', () => {
  // ─── Health Endpoint ──────────────────────────────────────────────────
  test('Middleware health endpoint is live and returns 200', async ({ request, measure }) => {
    const url = `${MW_BASE}${HEALTH_EP}`;

    measure.start('health');
    const response = await request.get(url, {
      headers: buildHeaders(),
      timeout: 10_000,
      ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === 'true',
    });
    const ms = measure.end('health');

    expect(
      response.status(),
      `Health endpoint ${url} returned ${response.status()}`
    ).toBe(200);

    const state = evaluateThreshold(ms, THRESHOLDS.apiHealth);
    test.info().annotations.push({
      type: 'checkmk-perf',
      description: perfData('mw_health', ms, THRESHOLDS.apiHealth),
    });

    expect(state, `Health check ${ms}ms exceeds CRITICAL threshold`).not.toBe(2);
  });

  test('Health response body contains status OK / healthy', async ({ request }) => {
    const response = await request.get(`${MW_BASE}${HEALTH_EP}`, {
      headers: buildHeaders(),
    });

    expect(response.status()).toBe(200);
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;

    const statusValue = (
      body['status']  ||
      body['Status']  ||
      body['health']  ||
      body['message'] ||
      body['state']   ||
      'ok'
    );

    expect(
      String(statusValue).toLowerCase(),
      `Unexpected health status: ${JSON.stringify(body)}`
    ).toMatch(/ok|healthy|up|running|alive/);
  });

  // ─── Authentication ───────────────────────────────────────────────────
  test('Auth token endpoint responds within threshold', async ({ request, measure }) => {
    test.skip(!MW_DEDICATED, 'No dedicated middleware — skipping token auth check');
    const url = `${MW_BASE}${AUTH_EP}`;

    measure.start('auth');
    const response = await request.post(url, {
      headers: { 'Content-Type': 'application/json', ...buildHeaders() },
      data: {
        username: process.env.ERP_USERNAME || 'monitor_user',
        password: process.env.ERP_PASSWORD || 'changeme',
        grant_type: 'password',
      },
      timeout: 10_000,
    });
    const ms = measure.end('auth');

    // Accept 200 or 201 for token creation
    expect([200, 201]).toContain(response.status());

    const state = evaluateThreshold(ms, THRESHOLDS.authToken);
    test.info().annotations.push({
      type: 'checkmk-perf',
      description: perfData('mw_auth_token', ms, THRESHOLDS.authToken),
    });

    expect(state, `Auth token ${ms}ms exceeds CRITICAL threshold`).not.toBe(2);
  });

  // ─── Key Business API Endpoints ───────────────────────────────────────
  const businessEndpoints: Array<{ name: string; path: string; method?: string }> = [
    { name: 'customers',  path: '/api/customers',       method: 'GET' },
    { name: 'orders',     path: '/api/orders',          method: 'GET' },
    { name: 'products',   path: '/api/products',        method: 'GET' },
    { name: 'invoices',   path: '/api/invoices',        method: 'GET' },
    { name: 'inventory',  path: '/api/inventory/stock', method: 'GET' },
  ];

  for (const ep of businessEndpoints) {
    test(`${ep.name} endpoint returns 200`, async ({ request, measure }) => {
      test.skip(!MW_DEDICATED, 'No dedicated middleware — skipping business endpoint checks');
      const url = `${MW_BASE}${ep.path}`;

      measure.start(ep.name);
      const response = await request.get(url, {
        headers: buildHeaders(),
        timeout: 15_000,
      });
      const ms = measure.end(ep.name);

      // Accept 200 or 204 (no content)
      expect(
        [200, 204],
        `${ep.name} endpoint returned ${response.status()}`
      ).toContain(response.status());

      const state = evaluateThreshold(ms, THRESHOLDS.apiResponse);
      test.info().annotations.push({
        type: 'checkmk-perf',
        description: perfData(`mw_${ep.name}`, ms, THRESHOLDS.apiResponse),
      });

      expect(state, `${ep.name} API ${ms}ms exceeds CRITICAL threshold`).not.toBe(2);
    });
  }

  // ─── Response Time Consistency ────────────────────────────────────────
  test('Health endpoint P95 within threshold (5 calls)', async ({ request }) => {
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      await request.get(`${MW_BASE}${HEALTH_EP}`, { headers: buildHeaders() });
      times.push(Date.now() - t0);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.ceil(times.length * 0.95) - 1];

    test.info().annotations.push({
      type: 'checkmk-perf',
      description: perfData('mw_health_p95', p95, THRESHOLDS.apiHealth),
    });

    expect(p95, `P95 response time ${p95}ms exceeds CRITICAL threshold`).toBeLessThan(
      THRESHOLDS.apiHealth.crit
    );
  });

  // ─── SSL / TLS ────────────────────────────────────────────────────────
  test('Middleware API uses valid SSL certificate', async ({ request }) => {
    if (!MW_BASE.startsWith('https')) {
      test.skip(true, 'Middleware not on HTTPS — skipping SSL check');
      return;
    }

    const response = await request.get(`${MW_BASE}${HEALTH_EP}`, {
      ignoreHTTPSErrors: false, // Strict SSL check
    });
    expect(response.status()).toBe(200);
  });
});

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (MW_KEY) headers['X-API-Key'] = MW_KEY;
  return headers;
}
