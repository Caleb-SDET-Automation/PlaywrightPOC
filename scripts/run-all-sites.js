#!/usr/bin/env node
/**
 * run-all-sites.js
 * Orchestrator: Runs Playwright monitoring against all enabled sites in parallel.
 * Called by RunDeck every 5–7 minutes.
 *
 * Usage:
 *   node scripts/run-all-sites.js [--group=us-east] [--concurrency=5] [--dry-run]
 *
 * Env overrides:
 *   SITE_CONCURRENCY=8   max parallel site runs
 *   SITE_GROUP=us-east   run only sites in this group
 *   RUN_TAGS=erp,ssrs    run only sites tagged with these (comma-sep)
 */
'use strict';

const { execSync, spawn } = require('child_process');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');

// ─── CLI args ──────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const CONCURRENCY = parseInt(process.env.SITE_CONCURRENCY || args.concurrency || '5', 10);
const GROUP_FILTER = process.env.SITE_GROUP  || args.group  || '';
const TAG_FILTER   = process.env.RUN_TAGS    || args.tags   || '';
const DRY_RUN      = args['dry-run'] === true || args['dry-run'] === 'true';
const ROOT         = path.resolve(__dirname, '..');

// ─── Load sites config (compiled or TS via ts-node) ───────────────────────
let sites;
try {
  // Try compiled JS first
  const distConfig = path.join(ROOT, 'dist', 'config', 'sites.config.js');
  if (fs.existsSync(distConfig)) {
    sites = require(distConfig).SITES;
  } else {
    // Fall back to ts-node
    require('ts-node').register({ project: path.join(ROOT, 'tsconfig.json') });
    sites = require(path.join(ROOT, 'config', 'sites.config.ts')).SITES;
  }
} catch (e) {
  console.error('[Orchestrator] Cannot load sites config:', e.message);
  process.exit(1);
}

// ─── Filter sites ─────────────────────────────────────────────────────────
let activeSites = sites.filter(s => s.enabled);
if (GROUP_FILTER) activeSites = activeSites.filter(s => s.group === GROUP_FILTER);
if (TAG_FILTER) {
  const tags = TAG_FILTER.split(',').map(t => t.trim());
  activeSites = activeSites.filter(s => tags.some(t => (s.tags || []).includes(t)));
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`  PLAYWRIGHT SYNTHETIC MONITOR — ORCHESTRATOR`);
console.log(`${'═'.repeat(60)}`);
console.log(`  Sites to run : ${activeSites.length}`);
console.log(`  Concurrency  : ${CONCURRENCY}`);
console.log(`  Group filter : ${GROUP_FILTER || 'all'}`);
console.log(`  Tag filter   : ${TAG_FILTER   || 'all'}`);
console.log(`  Dry run      : ${DRY_RUN}`);
console.log(`  Start time   : ${new Date().toISOString()}`);
console.log(`${'═'.repeat(60)}\n`);

if (DRY_RUN) {
  console.log('Sites that would run:');
  activeSites.forEach(s => console.log(`  ${s.id.padEnd(20)} ${s.name}`));
  process.exit(0);
}

// ─── Results tracking ────────────────────────────────────────────────────
const results = [];

async function runSite(site) {
  return new Promise(resolve => {
    const env = {
      ...process.env,
      SITE_ID:              site.id,
      SITE_NAME:            site.name,
      SITE_GROUP:           site.group,
      BASE_URL:             site.erp.baseUrl,
      ERP_USERNAME:         site.erp.username,
      ERP_PASSWORD:         site.erp.password,
      ERP_TENANT:           site.erp.tenant || '',
      MIDDLEWARE_BASE_URL:  site.middleware.baseUrl,
      MIDDLEWARE_API_KEY:   site.middleware.apiKey || '',
      SSRS_BASE_URL:        site.ssrs.baseUrl,
      SSRS_USERNAME:        site.ssrs.username,
      SSRS_PASSWORD:        site.ssrs.password,
      CHECKMK_HOST_NAME:    site.checkmk.hostName,
      STORAGE_STATE:        path.join(ROOT, '.auth', `state-${site.id}.json`),
      REPORT_OUTPUT_DIR:    path.join(ROOT, 'reports'),
    };

    const args = [
      'test',
      '--reporter=json',
      `--output=reports/artifacts/${site.id}`,
    ];

    const t0   = Date.now();
    const proc = spawn('npx', ['playwright', ...args], {
      cwd: ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });

    proc.on('close', code => {
      const duration = Date.now() - t0;
      const status   = code === 0 ? 'PASSED' : 'FAILED';
      const result   = { siteId: site.id, siteName: site.name, status, duration, code };
      results.push(result);

      const icon = code === 0 ? '✓' : '✗';
      console.log(`  ${icon} [${site.id.padEnd(18)}] ${status.padEnd(7)} ${(duration/1000).toFixed(1)}s`);

      // Save per-site stdout log
      const logDir = path.join(ROOT, 'reports', 'logs');
      fs.mkdirSync(logDir, { recursive: true });
      fs.writeFileSync(path.join(logDir, `${site.id}.log`), stdout + '\n' + stderr);

      resolve(result);
    });
  });
}

// ─── Parallel execution with concurrency limit ───────────────────────────
async function runWithConcurrency(tasks, limit) {
  const executing = [];
  for (const task of tasks) {
    const p = task().then(result => { executing.splice(executing.indexOf(p), 1); return result; });
    executing.push(p);
    if (executing.length >= limit) await Promise.race(executing);
  }
  return Promise.all(executing);
}

(async () => {
  const startTime = Date.now();
  const tasks = activeSites.map(site => () => runSite(site));

  console.log('Running sites...\n');
  await runWithConcurrency(tasks, CONCURRENCY);

  const elapsed = Date.now() - startTime;

  // ─── Final summary ────────────────────────────────────────────────
  const passed  = results.filter(r => r.status === 'PASSED').length;
  const failed  = results.filter(r => r.status === 'FAILED').length;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ORCHESTRATOR COMPLETE`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Total sites : ${results.length}`);
  console.log(`  Passed      : ${passed}`);
  console.log(`  Failed      : ${failed}`);
  console.log(`  Elapsed     : ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`  End time    : ${new Date().toISOString()}`);
  console.log(`${'═'.repeat(60)}\n`);

  if (failed > 0) {
    console.log('Failed sites:');
    results.filter(r => r.status === 'FAILED').forEach(r => {
      console.log(`  ✗ ${r.siteId} (${r.siteName})`);
    });
    console.log('');
  }

  // ─── Write orchestrator summary JSON ────────────────────────────
  const summaryPath = path.join(ROOT, 'reports', 'consolidated', 'orchestrator-summary.json');
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    elapsed,
    total: results.length,
    passed,
    failed,
    sites: results,
  }, null, 2));

  // Exit with non-zero if any site failed
  process.exit(failed > 0 ? 1 : 0);
})();
