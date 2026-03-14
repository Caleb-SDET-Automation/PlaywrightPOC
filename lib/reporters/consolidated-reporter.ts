/**
 * Consolidated HTML/JSON Reporter
 * Aggregates results across all sites into a single dashboard.
 * Written to: reports/consolidated/index.html + summary.json
 */
import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from '@playwright/test/reporter';
import * as fs   from 'fs';
import * as path from 'path';

interface TestRecord {
  siteId:      string;
  siteName:    string;
  suite:       string;
  test:        string;
  status:      string;
  duration:    number;
  error?:      string;
  perfData:    Record<string, string>;
  timestamp:   string;
}

interface SiteSummary {
  siteId:   string;
  siteName: string;
  total:    number;
  passed:   number;
  failed:   number;
  skipped:  number;
  duration: number;
  status:   'OK' | 'WARN' | 'CRIT';
}

class ConsolidatedReporter implements Reporter {
  private records: TestRecord[] = [];
  private startTime = Date.now();
  private outputDir: string;

  constructor() {
    this.outputDir = process.env.REPORT_OUTPUT_DIR
      ? path.join(process.env.REPORT_OUTPUT_DIR, 'consolidated')
      : 'reports/consolidated';
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const titles = test.titlePath();
    const perf: Record<string, string> = {};

    for (const ann of result.annotations ?? []) {
      if (ann.type === 'checkmk-perf' && ann.description) {
        perf['checkmk'] = ann.description;
      }
      if (ann.type === 'perf' && ann.description) {
        perf['timing'] = ann.description;
      }
    }

    this.records.push({
      siteId:    process.env.SITE_ID   || 'default',
      siteName:  process.env.SITE_NAME || 'Default',
      suite:     titles.slice(1, -1).join(' > '),
      test:      titles[titles.length - 1] || test.title,
      status:    result.status,
      duration:  result.duration ?? 0,
      error:     result.error?.message?.split('\n')[0],
      perfData:  perf,
      timestamp: new Date().toISOString(),
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    const totalDuration = Date.now() - this.startTime;

    // Build per-site summaries
    const siteMap = new Map<string, SiteSummary>();
    for (const r of this.records) {
      if (!siteMap.has(r.siteId)) {
        siteMap.set(r.siteId, {
          siteId:   r.siteId,
          siteName: r.siteName,
          total: 0, passed: 0, failed: 0, skipped: 0, duration: 0, status: 'OK',
        });
      }
      const s = siteMap.get(r.siteId)!;
      s.total++;
      s.duration += r.duration;
      if (r.status === 'passed')       s.passed++;
      else if (r.status === 'skipped') s.skipped++;
      else                             s.failed++;
    }

    for (const s of siteMap.values()) {
      const failRate = s.total > 0 ? s.failed / s.total : 0;
      s.status = failRate > 0.5 ? 'CRIT' : failRate > 0 ? 'WARN' : 'OK';
    }

    const summaries = Array.from(siteMap.values());
    const runId     = process.env.RUN_ID || `run-${Date.now()}`;
    const runTs     = new Date().toISOString();

    // ─── JSON Summary ──────────────────────────────────────────────────
    const jsonSummary = {
      runId,
      timestamp:     runTs,
      totalDuration,
      overallStatus: result.status,
      sites:         summaries,
      tests:         this.records,
    };

    const jsonPath = path.join(this.outputDir, 'summary.json');
    fs.writeFileSync(jsonPath, JSON.stringify(jsonSummary, null, 2));

    // ─── HTML Dashboard ───────────────────────────────────────────────
    const htmlPath = path.join(this.outputDir, 'index.html');
    fs.writeFileSync(htmlPath, this.buildHTML(runId, runTs, totalDuration, summaries, result.status));

    console.log(`\n[Consolidated Report] Written to ${htmlPath}`);
    this.printConsoleSummary(summaries, result.status);
  }

  // ─── HTML Builder ─────────────────────────────────────────────────────
  private buildHTML(
    runId: string,
    ts: string,
    duration: number,
    sites: SiteSummary[],
    overallStatus: string,
  ): string {
    const statusColor = (s: string) =>
      s === 'OK' || s === 'passed' ? '#22c55e' :
      s === 'WARN' || s === 'flaky' ? '#f59e0b' :
      s === 'CRIT' || s === 'failed' ? '#ef4444' : '#94a3b8';

    const totalPassed  = sites.reduce((a, s) => a + s.passed,  0);
    const totalFailed  = sites.reduce((a, s) => a + s.failed,  0);
    const totalSkipped = sites.reduce((a, s) => a + s.skipped, 0);
    const totalTests   = sites.reduce((a, s) => a + s.total,   0);
    const passRate     = totalTests ? ((totalPassed / totalTests) * 100).toFixed(1) : '0';

    const siteRows = sites.map(s => `
      <tr>
        <td><strong>${s.siteId}</strong></td>
        <td>${s.siteName}</td>
        <td>${s.total}</td>
        <td style="color:#22c55e">${s.passed}</td>
        <td style="color:#ef4444">${s.failed}</td>
        <td style="color:#94a3b8">${s.skipped}</td>
        <td>${(s.duration / 1000).toFixed(1)}s</td>
        <td><span class="badge" style="background:${statusColor(s.status)}">${s.status}</span></td>
      </tr>`).join('');

    const failedTests = this.records
      .filter(r => r.status !== 'passed' && r.status !== 'skipped')
      .map(r => `
        <tr>
          <td>${r.siteId}</td>
          <td>${r.suite}</td>
          <td>${r.test}</td>
          <td><span class="badge" style="background:${statusColor(r.status)}">${r.status}</span></td>
          <td style="font-size:0.8em;color:#ef4444">${r.error || ''}</td>
        </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="300">
  <title>Playwright Synthetic Monitor — ${ts}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #0f172a; color: #e2e8f0; padding: 24px; }
    h1   { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
    h2   { font-size: 1.1rem; font-weight: 600; margin: 24px 0 12px; color: #94a3b8; }
    .meta { font-size: 0.85rem; color: #64748b; margin-bottom: 24px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                gap: 16px; margin-bottom: 32px; }
    .kpi { background: #1e293b; border-radius: 12px; padding: 20px; text-align: center; }
    .kpi .value { font-size: 2rem; font-weight: 700; }
    .kpi .label { font-size: 0.8rem; color: #64748b; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; background: #1e293b;
            border-radius: 12px; overflow: hidden; margin-bottom: 32px; }
    th   { background: #0f172a; padding: 10px 14px; text-align: left;
           font-size: 0.8rem; color: #64748b; text-transform: uppercase; }
    td   { padding: 10px 14px; border-top: 1px solid #0f172a; font-size: 0.9rem; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px;
             color: #fff; font-size: 0.75rem; font-weight: 600; }
    .overall { padding: 12px 20px; border-radius: 8px; display: inline-block;
               font-weight: 600; margin-bottom: 24px;
               background: ${statusColor(overallStatus)}22;
               border: 1px solid ${statusColor(overallStatus)};
               color: ${statusColor(overallStatus)}; }
  </style>
</head>
<body>
  <h1>Playwright Synthetic Monitoring</h1>
  <div class="meta">Run ID: ${runId} &nbsp;|&nbsp; ${ts} &nbsp;|&nbsp; Duration: ${(duration / 1000).toFixed(1)}s</div>

  <div class="overall">Overall: ${overallStatus.toUpperCase()}</div>

  <div class="kpi-grid">
    <div class="kpi">
      <div class="value" style="color:#94a3b8">${sites.length}</div>
      <div class="label">Sites Monitored</div>
    </div>
    <div class="kpi">
      <div class="value" style="color:#94a3b8">${totalTests}</div>
      <div class="label">Total Checks</div>
    </div>
    <div class="kpi">
      <div class="value" style="color:#22c55e">${totalPassed}</div>
      <div class="label">Passed</div>
    </div>
    <div class="kpi">
      <div class="value" style="color:#ef4444">${totalFailed}</div>
      <div class="label">Failed</div>
    </div>
    <div class="kpi">
      <div class="value" style="color:#f59e0b">${totalSkipped}</div>
      <div class="label">Skipped</div>
    </div>
    <div class="kpi">
      <div class="value" style="color:#22c55e">${passRate}%</div>
      <div class="label">Pass Rate</div>
    </div>
  </div>

  <h2>Site Summary</h2>
  <table>
    <thead>
      <tr>
        <th>Site ID</th><th>Name</th><th>Total</th>
        <th>Passed</th><th>Failed</th><th>Skipped</th>
        <th>Duration</th><th>Status</th>
      </tr>
    </thead>
    <tbody>${siteRows}</tbody>
  </table>

  ${failedTests ? `
  <h2>Failed / Errored Checks</h2>
  <table>
    <thead>
      <tr><th>Site</th><th>Suite</th><th>Test</th><th>Status</th><th>Error</th></tr>
    </thead>
    <tbody>${failedTests}</tbody>
  </table>` : ''}

  <div class="meta">Auto-refreshes every 5 minutes &nbsp;|&nbsp; Powered by Playwright Synthetic Monitor</div>
</body>
</html>`;
  }

  private printConsoleSummary(sites: SiteSummary[], overallStatus: string): void {
    const passed  = sites.reduce((a, s) => a + s.passed,  0);
    const failed  = sites.reduce((a, s) => a + s.failed,  0);
    const total   = sites.reduce((a, s) => a + s.total,   0);

    console.log('\n══════════════════════════════════════════════');
    console.log('  SYNTHETIC MONITORING CONSOLIDATED REPORT');
    console.log('══════════════════════════════════════════════');
    console.log(`  Overall:  ${overallStatus.toUpperCase()}`);
    console.log(`  Sites:    ${sites.length}`);
    console.log(`  Checks:   ${total} total | ${passed} passed | ${failed} failed`);
    console.log(`  Pass rate: ${total ? ((passed / total) * 100).toFixed(1) : 0}%`);
    console.log('══════════════════════════════════════════════\n');
  }
}

export default ConsolidatedReporter;
