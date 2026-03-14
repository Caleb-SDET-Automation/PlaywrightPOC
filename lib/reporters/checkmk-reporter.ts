/**
 * CheckMK Playwright Reporter
 * Reads test results, extracts perf-data annotations, and submits
 * passive check results to CheckMK Pro after each test run.
 */
import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from '@playwright/test/reporter';
import { CheckMKClient } from '../checkmk/client';

interface PerfEntry {
  serviceName: string;
  state:       0 | 1 | 2 | 3;
  output:      string;
  perfData:    string;
}

class CheckMKReporter implements Reporter {
  private client!: CheckMKClient;
  private hostName!: string;
  private pendingChecks: PerfEntry[] = [];
  private enabled = false;

  onBegin(config: FullConfig, suite: Suite): void {
    const url      = process.env.CHECKMK_URL;
    const secret   = process.env.CHECKMK_SECRET;

    if (!url || !secret) {
      console.log('[CheckMK] Reporter disabled — CHECKMK_URL / CHECKMK_SECRET not set');
      return;
    }

    this.enabled  = true;
    this.hostName = process.env.CHECKMK_HOST_NAME || `pw-${process.env.SITE_ID || 'default'}`;
    this.client   = CheckMKClient.fromEnv();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (!this.enabled) return;

    // Derive service name from test title path
    const service = test.titlePath()
      .slice(1)                          // drop file path
      .join(' / ')
      .replace(/[^a-zA-Z0-9 /_-]/g, '') // sanitize
      .trim()
      .substring(0, 100);

    // Map Playwright status to CheckMK state
    const state = this.mapStatus(result.status);

    // Collect perf data from annotations
    const perfDataParts: string[] = [];
    for (const ann of result.annotations ?? []) {
      if (ann.type === 'checkmk-perf' && ann.description) {
        perfDataParts.push(ann.description);
      }
    }

    const duration = result.duration ?? 0;
    const output   = state === 0
      ? `OK - ${service} passed in ${duration}ms`
      : `${['OK','WARNING','CRITICAL','UNKNOWN'][state]} - ${service} ${result.status} (${result.error?.message?.split('\n')[0] ?? 'no detail'})`;

    this.pendingChecks.push({
      serviceName: service,
      state,
      output,
      perfData: perfDataParts.join(' '),
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    if (!this.enabled || this.pendingChecks.length === 0) return;

    const batchResults = this.pendingChecks.map(c => ({
      hostName:    this.hostName,
      serviceName: c.serviceName,
      state:       c.state,
      output:      c.output,
      perfData:    c.perfData || undefined,
    }));

    try {
      const { succeeded, errors } = await this.client.submitBatch(batchResults);
      console.log(
        `[CheckMK] Submitted ${succeeded.length} checks` +
        (errors.length ? ` (${errors.length} failed)` : ''),
      );
      if (errors.length > 0) {
        for (const e of errors) {
          console.error(`[CheckMK] Failed: ${e.result.serviceName} — ${e.error}`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[CheckMK] Batch submit error: ${msg}`);
    }
  }

  private mapStatus(status: string): 0 | 1 | 2 | 3 {
    switch (status) {
      case 'passed':    return 0;
      case 'flaky':     return 1;
      case 'failed':    return 2;
      case 'timedOut':  return 2;
      case 'skipped':   return 3;
      default:          return 3;
    }
  }
}

export default CheckMKReporter;
