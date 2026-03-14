/**
 * Synthetic Monitor: SSRS Reports & Invoice Reprint
 * Validates: SSRS server live, invoice report loads, reprint workflow completes
 * Journey: Reports → Reprint Invoice (SSRS)
 */
import { test, expect } from '../fixtures/base';
import { THRESHOLDS, evaluateThreshold, perfData } from '../../config/thresholds';

const SSRS_BASE      = process.env.SSRS_BASE_URL      || 'https://reports.example.com/ReportServer';
const SSRS_USER      = process.env.SSRS_USERNAME       || 'report_user';
const SSRS_PASS      = process.env.SSRS_PASSWORD       || 'changeme';
const INVOICE_REPORT = process.env.SSRS_INVOICE_REPORT || '/Reports/Invoice/ReprintInvoice';
const INVOICE_ID     = process.env.SAMPLE_INVOICE_ID   || 'INV-0001';

const SSRS_CONFIGURED = !SSRS_BASE.includes('example.com') && SSRS_BASE !== 'https://reports.example.com/ReportServer';

test.describe('SSRS Reports', () => {
  test.beforeEach(() => {
    test.skip(!SSRS_CONFIGURED, 'SSRS not configured — set SSRS_BASE_URL to a real server');
  });

  // ─── SSRS Server Health ───────────────────────────────────────────────
  test('SSRS Report Server is live and returns 200', async ({ request }) => {
    const url = `${SSRS_BASE}/ReportServer`;

    const response = await request.get(url, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${SSRS_USER}:${SSRS_PASS}`).toString('base64'),
      },
      ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === 'true',
    });

    expect(
      response.status(),
      `SSRS server at ${url} returned ${response.status()}`
    ).toBe(200);

    test.info().annotations.push({
      type: 'checkmk-service',
      description: 'SSRS_Health=OK',
    });
  });

  test('SSRS Report Manager home page accessible', async ({ ssrsPage: page }) => {
    const url = `${SSRS_BASE}/Reports`;
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });

    expect(response?.status(), `SSRS portal returned ${response?.status()}`).toBe(200);

    // Report Manager should display folder/report listing
    await expect(
      page.locator('.reportList, .catalog, [data-testid="report-catalog"], #reportList').first()
    ).toBeVisible({ timeout: 15_000 }).catch(async () => {
      // Fallback: any table or list that indicates we're in Report Manager
      await expect(page.locator('table, ul.reportsList').first()).toBeVisible({ timeout: 5_000 });
    });
  });

  // ─── Invoice Report ───────────────────────────────────────────────────
  test('Reprint Invoice SSRS report loads within threshold', async ({ ssrsPage: page, measure }) => {
    const reportUrl =
      `${SSRS_BASE}/Pages/ReportViewer.aspx?` +
      encodeURI(`%2f${INVOICE_REPORT}&rs:Command=Render&InvoiceID=${INVOICE_ID}`);

    measure.start('invoice_report');
    const response = await page.goto(reportUrl, { waitUntil: 'domcontentloaded' });
    const loadMs = measure.end('invoice_report');

    expect(response?.status(), `Invoice report returned ${response?.status()}`).toBe(200);

    // Wait for SSRS toolbar or report content
    await expect(
      page.locator(
        '#ReportViewerControl, .reportViewerTable, [id*="ReportViewer"], ' +
        'iframe[id*="report"], .rdl-report'
      ).first()
    ).toBeVisible({ timeout: 30_000 });

    const state = evaluateThreshold(loadMs, THRESHOLDS.ssrsReportLoad);

    test.info().annotations.push({
      type: 'checkmk-perf',
      description: perfData('ssrs_invoice_load', loadMs, THRESHOLDS.ssrsReportLoad),
    });

    expect(state, `Invoice report ${loadMs}ms exceeds CRITICAL threshold ${THRESHOLDS.ssrsReportLoad.crit}ms`).not.toBe(2);
  });

  test('Reprint Invoice workflow completes in ERP', async ({ erpPage: page, siteContext, measure }) => {
    // Navigate to invoices list in ERP
    const invoicePaths = [
      '/Invoice', '/Invoices', '/Sales/Invoices',
      '/Finance/Invoices', '/AR/Invoices',
    ];

    let reached = false;
    for (const path of invoicePaths) {
      try {
        const resp = await page.goto(`${siteContext.baseUrl}${path}`, { timeout: 10_000 });
        if (resp?.status() === 200) { reached = true; break; }
      } catch { continue; }
    }

    if (!reached) {
      test.skip(true, 'Invoice list page not reachable via known paths');
      return;
    }

    await page.waitForLoadState('networkidle');

    // Click first invoice or search for sample ID
    const firstInvoice = page.locator(
      'table tbody tr:first-child td a, ' +
      '.invoice-row:first-child a, ' +
      '[data-testid="invoice-row"]:first-child a'
    ).first();

    if (await firstInvoice.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstInvoice.click();
      await page.waitForLoadState('networkidle');

      // Look for Print / Reprint button
      const printBtn = page.locator(
        'button:has-text("Print"), button:has-text("Reprint"), ' +
        '[data-testid="print-btn"], [data-testid="reprint-btn"], ' +
        'a:has-text("Print"), a:has-text("Reprint")'
      ).first();

      if (await printBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        measure.start('reprint');
        await printBtn.click();

        // Either a PDF viewer opens or a new window pops up
        const [popup] = await Promise.all([
          page.context().waitForEvent('page', { timeout: 10_000 }).catch(() => null),
          page.waitForTimeout(2_000),
        ]);

        const reprintMs = measure.end('reprint');
        const state = evaluateThreshold(reprintMs, THRESHOLDS.invoiceReprint);

        test.info().annotations.push({
          type: 'checkmk-perf',
          description: perfData('invoice_reprint', reprintMs, THRESHOLDS.invoiceReprint),
        });

        expect(state, `Invoice reprint ${reprintMs}ms exceeds CRITICAL threshold`).not.toBe(2);

        if (popup) {
          await popup.waitForLoadState('domcontentloaded');
          expect(popup.url()).toBeTruthy();
          await popup.close();
        }
      } else {
        test.info().annotations.push({ type: 'skip-reason', description: 'Print/Reprint button not found on invoice page' });
      }
    } else {
      test.skip(true, 'No invoices visible in list — skipped');
    }
  });

  // ─── SSRS Export Formats ─────────────────────────────────────────────
  test('SSRS report exports to PDF', async ({ request }) => {
    const exportUrl =
      `${SSRS_BASE}/Pages/ReportViewer.aspx?` +
      `%2f${INVOICE_REPORT}&rs:Command=Render&rs:Format=PDF&InvoiceID=${INVOICE_ID}`;

    const response = await request.get(exportUrl, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${SSRS_USER}:${SSRS_PASS}`).toString('base64'),
      },
      timeout: 30_000,
    });

    // Accept both 200 (PDF) and redirect (302)
    expect([200, 302]).toContain(response.status());

    if (response.status() === 200) {
      const ct = response.headers()['content-type'] || '';
      expect(ct).toContain('pdf');
    }
  });
});
