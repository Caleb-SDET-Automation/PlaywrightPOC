#!/usr/bin/env node
/**
 * scheduler.js — Local Node.js-based cron scheduler
 * Alternative to RunDeck for environments that don't have it installed.
 * Runs monitoring every 5 minutes 24/7 (unattended mode).
 *
 * Usage:
 *   node scripts/scheduler.js              # uses .env defaults
 *   node scripts/scheduler.js --interval=7 # override to 7 minutes
 *   node scripts/scheduler.js --group=us-east --interval=5
 *
 * Run as a daemon:
 *   nohup node scripts/scheduler.js >> logs/scheduler.log 2>&1 &
 *   pm2 start scripts/scheduler.js --name playwright-monitor
 */
'use strict';

const cron     = require('node-cron');
const { spawn } = require('child_process');
const path     = require('path');
const fs       = require('fs');

// ─── Load .env ────────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

// ─── CLI args ─────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const INTERVAL_MIN  = parseInt(args.interval || process.env.MONITOR_INTERVAL_MIN || '5', 10);
const GROUP_FILTER  = args.group   || process.env.SITE_GROUP || '';
const CONCURRENCY   = args.concurrency || process.env.SITE_CONCURRENCY || '5';
const ROOT          = path.resolve(__dirname, '..');
const LOG_DIR       = path.join(ROOT, 'reports', 'logs');

fs.mkdirSync(LOG_DIR, { recursive: true });

// ─── Build cron expression ────────────────────────────────────────────────
// node-cron format: second minute hour day-of-month month day-of-week
const cronExpr = `0 */${INTERVAL_MIN} * * * *`; // every N minutes at :00s

// ─── State tracking ───────────────────────────────────────────────────────
let isRunning   = false;
let runCount    = 0;
let lastRun: Date | null = null;
let lastStatus  = 'PENDING';

function log(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
}

// ─── Execute monitoring run ───────────────────────────────────────────────
function runMonitoring(): Promise<void> {
  return new Promise(resolve => {
    if (isRunning) {
      log('⚠ Previous run still in progress — skipping this cycle');
      resolve();
      return;
    }

    isRunning   = true;
    runCount++;
    lastRun     = new Date();
    const runId = `run-${runCount}-${Date.now()}`;

    log(`▶ Starting run #${runCount} (${runId})`);

    const env = {
      ...process.env,
      SITE_GROUP:       GROUP_FILTER,
      SITE_CONCURRENCY: CONCURRENCY,
      RUN_ID:           runId,
    };

    const logFile = path.join(LOG_DIR, `scheduler-${runId}.log`);
    const out     = fs.openSync(logFile, 'w');

    const proc = spawn('node', ['scripts/run-all-sites.js'], {
      cwd: ROOT,
      env,
      stdio: ['ignore', out, out],
    });

    proc.on('close', code => {
      fs.closeSync(out);
      isRunning  = false;
      lastStatus = code === 0 ? 'OK' : 'FAILED';

      if (code === 0) {
        log(`✓ Run #${runCount} complete — OK`);
      } else {
        log(`✗ Run #${runCount} FAILED (exit ${code}) — see ${logFile}`);
      }

      // Write status file for external health checks
      const statusPath = path.join(ROOT, 'reports', 'scheduler-status.json');
      fs.writeFileSync(statusPath, JSON.stringify({
        runCount,
        lastRun:    lastRun?.toISOString(),
        lastStatus,
        intervalMin: INTERVAL_MIN,
        group:       GROUP_FILTER || 'all',
        nextRun:     new Date(Date.now() + INTERVAL_MIN * 60_000).toISOString(),
      }, null, 2));

      resolve();
    });
  });
}

// ─── Register cron job ────────────────────────────────────────────────────
log('═'.repeat(60));
log('  Playwright Synthetic Monitor — Scheduler');
log(`  Interval  : every ${INTERVAL_MIN} minute(s)`);
log(`  Group     : ${GROUP_FILTER || 'all sites'}`);
log(`  Cron      : ${cronExpr}`);
log(`  Log dir   : ${LOG_DIR}`);
log('═'.repeat(60));

if (!cron.validate(cronExpr)) {
  console.error(`Invalid cron expression: ${cronExpr}`);
  process.exit(1);
}

// Run immediately on start, then on schedule
log('Running first check immediately on startup...');
runMonitoring().then(() => {
  log(`Scheduling subsequent runs: ${cronExpr}`);
  cron.schedule(cronExpr, () => { runMonitoring(); });
});

// ─── Graceful shutdown ────────────────────────────────────────────────────
process.on('SIGINT',  () => { log('Scheduler stopped (SIGINT)');  process.exit(0); });
process.on('SIGTERM', () => { log('Scheduler stopped (SIGTERM)'); process.exit(0); });

// ─── Status endpoint (simple HTTP) ───────────────────────────────────────
const http = require('http');
const STATUS_PORT = parseInt(process.env.SCHEDULER_STATUS_PORT || '9999', 10);

http.createServer((_req: unknown, res: {
  writeHead: (code: number, headers: Record<string, string>) => void;
  end: (body: string) => void;
}) => {
  const status = {
    status:      lastStatus,
    runCount,
    isRunning,
    lastRun:     lastRun?.toISOString() || null,
    intervalMin: INTERVAL_MIN,
    group:       GROUP_FILTER || 'all',
    uptime:      process.uptime(),
  };
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(status, null, 2));
}).listen(STATUS_PORT, () => {
  log(`Status endpoint: http://localhost:${STATUS_PORT}/`);
});
