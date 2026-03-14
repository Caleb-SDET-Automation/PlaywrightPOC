#!/usr/bin/env node
/**
 * setup-all.js — One-command bootstrap
 * Runs all setup steps that can complete locally.
 *
 * Usage: node scripts/setup-all.js
 */
'use strict';

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const ROOT = path.resolve(__dirname, '..');
const PASS = '✓';
const FAIL = '✗';
const SKIP = '↷';

let errors = 0;

function step(label, fn) {
  process.stdout.write(`  ${label.padEnd(50)}`);
  try {
    const result = fn();
    console.log(`${PASS} ${result || 'OK'}`);
  } catch (err) {
    console.log(`${FAIL} ${err.message}`);
    errors++;
  }
}

function stepOptional(label, fn) {
  process.stdout.write(`  ${label.padEnd(50)}`);
  try {
    const result = fn();
    console.log(`${PASS} ${result || 'OK'}`);
  } catch (err) {
    console.log(`${SKIP} skipped (${err.message.split('\n')[0]})`);
  }
}

console.log('\n' + '═'.repeat(60));
console.log('  Playwright Synthetic Monitor — Full Setup');
console.log('═'.repeat(60) + '\n');

// ─── 1. Verify Node version ──────────────────────────────────────────────
console.log('1. Runtime checks');
step('Node.js version ≥ 18', () => {
  const ver = parseInt(process.versions.node.split('.')[0], 10);
  if (ver < 18) throw new Error(`Node ${process.versions.node} — upgrade to ≥18`);
  return `v${process.versions.node}`;
});

step('npm version', () => {
  const v = execSync('npm --version', { encoding: 'utf8' }).trim();
  return `v${v}`;
});

// ─── 2. Install dependencies ─────────────────────────────────────────────
console.log('\n2. Dependencies');
step('node_modules present', () => {
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    execSync('npm ci', { cwd: ROOT, stdio: 'inherit' });
  }
  return 'node_modules present';
});

step('Playwright browsers installed', () => {
  const r = spawnSync('npx', ['playwright', 'install', 'chromium', '--with-deps'], {
    cwd: ROOT, stdio: 'pipe', encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(r.stderr || 'browser install failed');
  return 'chromium ready';
});

// ─── 3. Directories ───────────────────────────────────────────────────────
console.log('\n3. Directories & files');
step('Create output directories', () => {
  const dirs = [
    '.auth', 'reports/json', 'reports/html', 'reports/consolidated',
    'reports/artifacts', 'reports/logs', 'reports/blob', '.env.sites',
  ];
  dirs.forEach(d => fs.mkdirSync(path.join(ROOT, d), { recursive: true }));
  return `${dirs.length} dirs`;
});

step('Create .env if missing', () => {
  const envPath   = path.join(ROOT, '.env');
  const exPath    = path.join(ROOT, '.env.example');
  if (!fs.existsSync(envPath)) {
    fs.copyFileSync(exPath, envPath);
    return 'copied from .env.example — EDIT IT NOW';
  }
  return '.env already exists';
});

// ─── 4. TypeScript validation ─────────────────────────────────────────────
console.log('\n4. Code validation');
step('TypeScript compiles without errors', () => {
  const r = spawnSync('npx', ['tsc', '--noEmit'], {
    cwd: ROOT, stdio: 'pipe', encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(r.stdout + r.stderr);
  return 'no errors';
});

step('Playwright config valid', () => {
  const r = spawnSync('npx', ['playwright', 'test', '--list', '--reporter=line'], {
    cwd: ROOT, stdio: 'pipe', encoding: 'utf8',
    env: { ...process.env, BASE_URL: 'https://placeholder.example.com', ERP_USERNAME: 'u', ERP_PASSWORD: 'p' },
  });
  if (r.status !== 0 && !r.stdout.includes('test')) throw new Error('config parse failed');
  const lines = (r.stdout || '').split('\n').filter(l => l.includes('spec.ts'));
  return `${lines.length} test file(s) found`;
});

step('Sites config loads (82 sites)', () => {
  // Use ts-node to load TS config
  const r = spawnSync('npx', ['ts-node', '-e',
    `const { SITES } = require('./config/sites.config'); console.log(SITES.length);`
  ], { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
  const count = parseInt(r.stdout.trim(), 10);
  if (isNaN(count) || count < 10) throw new Error('sites config failed to load: ' + r.stderr);
  return `${count} sites loaded`;
});

// ─── 5. Orchestrator dry-run ──────────────────────────────────────────────
console.log('\n5. Orchestrator');
step('Dry-run (no actual browser launch)', () => {
  const r = spawnSync('node', ['scripts/run-all-sites.js', '--dry-run'], {
    cwd: ROOT, stdio: 'pipe', encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(r.stderr || 'dry-run failed');
  const lines = r.stdout.split('\n').filter(l => l.trim());
  return `${lines.length} lines output`;
});

// ─── 6. MCP setup ────────────────────────────────────────────────────────
console.log('\n6. Playwright MCP');
step('@playwright/mcp package available', () => {
  const pkgPath = path.join(ROOT, 'node_modules', '@playwright', 'mcp', 'package.json');
  if (!fs.existsSync(pkgPath)) throw new Error('not installed');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return `v${pkg.version}`;
});

// Claude Desktop
stepOptional('Claude Desktop config written', () => {
  const claudeDir = path.join(os.homedir(), 'Library', 'Application Support', 'Claude');
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }
  const cfgPath = path.join(claudeDir, 'claude_desktop_config.json');
  let cfg = {};
  if (fs.existsSync(cfgPath)) {
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }
  cfg.mcpServers = cfg.mcpServers || {};
  if (!cfg.mcpServers.playwright) {
    cfg.mcpServers.playwright = {
      command: 'npx',
      args: ['@playwright/mcp@latest'],
      env: { PLAYWRIGHT_HEADLESS: 'false' },
    };
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
    return 'playwright MCP added — restart Claude Desktop';
  }
  return 'already configured';
});

// Cursor
stepOptional('Cursor MCP config written', () => {
  const cursorDir = path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User');
  const settingsPath = path.join(cursorDir, 'settings.json');
  if (!fs.existsSync(settingsPath)) throw new Error('Cursor settings.json not found');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  settings['chat.mcp.enabled'] = true;
  settings['mcp.servers'] = settings['mcp.servers'] || {};
  if (!settings['mcp.servers'].playwright) {
    settings['mcp.servers'].playwright = {
      type: 'stdio',
      command: 'npx',
      args: ['@playwright/mcp@latest'],
    };
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return 'playwright MCP added to Cursor';
  }
  return 'already configured';
});

// ─── 7. CheckMK / RunDeck (external — informational only) ────────────────
console.log('\n7. External integrations (skipped — requires live servers)');
console.log(`  ${SKIP}  CheckMK Pro               configure CHECKMK_URL + CHECKMK_SECRET in .env`);
console.log(`       then run: npm run setup:checkmk`);
console.log(`  ${SKIP}  RunDeck                   import rundeck/job-definition.xml into RunDeck UI`);
console.log(`  ${SKIP}  Local scheduler (no Rundeck)  run: npm run monitor:schedule`);

// ─── Summary ──────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
if (errors === 0) {
  console.log('  ✓ Setup complete — all local steps passed\n');
  console.log('  Next steps:');
  console.log('  1. Edit .env with your real ERP/middleware/SSRS URLs');
  console.log('  2. Add real site URLs to config/sites.config.ts');
  console.log('  3. Run:  npm run monitor:dry-run        (verify config)');
  console.log('  4. Run:  npm run monitor:all             (live run)');
  console.log('  5. Run:  npm run monitor:schedule        (continuous, no RunDeck)');
  console.log('  6. Open: reports/consolidated/index.html (after first run)');
} else {
  console.log(`  ✗ Setup completed with ${errors} error(s) — see above\n`);
}
console.log('═'.repeat(60) + '\n');

process.exit(errors > 0 ? 1 : 0);
