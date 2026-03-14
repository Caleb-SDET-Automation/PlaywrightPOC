# PlaywrightPOC — Synthetic & Real-User Monitoring Framework

End-to-end synthetic monitoring platform for ERP and Middleware applications.
Runs critical user journeys every 5–7 minutes across 80+ sites in unattended mode via RunDeck,
with results pushed to CheckMK Pro and displayed in a consolidated HTML dashboard.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
   - [Environment Variables](#environment-variables)
   - [Sites Registry](#sites-registry)
   - [Thresholds](#thresholds)
5. [Test Suites](#test-suites)
6. [Running Tests](#running-tests)
7. [CheckMK Pro Integration](#checkmk-pro-integration)
8. [RunDeck Integration](#rundeck-integration)
9. [Playwright MCP](#playwright-mcp)
10. [Consolidated Reporting](#consolidated-reporting)
11. [Supported Demo Sites](#supported-demo-sites)
12. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        RunDeck                              │
│  Jobs: global / regional / api-quick / cleanup (5–7 min)   │
└──────────────────────┬──────────────────────────────────────┘
                       │ triggers
┌──────────────────────▼──────────────────────────────────────┐
│           scripts/run-monitoring.sh  (entry point)          │
│           scripts/run-all-sites.js   (parallel orchestrator)│
│           Concurrency: configurable (default 4 workers)     │
└──────────┬────────────────────────────────────┬─────────────┘
           │ per site                           │
┌──────────▼──────────┐              ┌──────────▼──────────────┐
│  Playwright Tests   │              │  Auth Setup             │
│  tests/synthetic/   │              │  tests/auth.setup.ts    │
│  - login.spec.ts    │              │  Saves .auth/state.json │
│  - landing.spec.ts  │              └─────────────────────────┘
│  - core-workflows   │
│  - reports.spec.ts  │
│  - middleware-api   │
│  - devices.spec.ts  │
└──────────┬──────────┘
           │ results
┌──────────▼─────────────────────────────────────────────────┐
│  Reporters                                                  │
│  - checkmk-reporter.ts  → CheckMK Pro passive checks       │
│  - consolidated-reporter.ts → reports/consolidated/         │
│  - HTML / JSON reports  → reports/html / reports/json/      │
└────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| Playwright Chromium | auto-installed |
| RunDeck | ≥ 4.x (optional) |
| CheckMK Pro | ≥ 2.x (optional) |

---

## Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd PlaywrightPOC

# 2. Install dependencies
npm install

# 3. Install Playwright browsers
npx playwright install chromium

# 4. Copy and configure environment
cp .env.example .env

# 5. Verify setup (dry-run — no browsers launched)
npm run monitor:dry-run

# 6. Verify TypeScript compiles
npx tsc --noEmit
```

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
# ─── Site Identity ────────────────────────────────────────────
SITE_ID=site-001
SITE_NAME="Head Office ERP"
SITE_GROUP=region-us-east

# ─── ERP Application ──────────────────────────────────────────
BASE_URL=https://erp.yourcompany.com
ERP_USERNAME=monitor_user
ERP_PASSWORD=your-password
LOGIN_PATH=/Account/Login
# Optional: visit this URL first before the login page (e.g. Dolibarr demo selector)
LOGIN_PREFLIGHT_URL=

# ─── Middleware / API ─────────────────────────────────────────
MIDDLEWARE_BASE_URL=https://api.yourcompany.com
MIDDLEWARE_API_KEY=your-api-key
MIDDLEWARE_HEALTH_ENDPOINT=/health
MIDDLEWARE_AUTH_ENDPOINT=/auth/token

# ─── SSRS Reports ─────────────────────────────────────────────
SSRS_BASE_URL=https://reports.yourcompany.com/ReportServer
SSRS_USERNAME=report_user
SSRS_PASSWORD=your-password
SSRS_INVOICE_REPORT=/Reports/Invoice/ReprintInvoice

# ─── Playwright Runtime ───────────────────────────────────────
HEADLESS=true
WORKERS=4
RETRIES=1
STORAGE_STATE=.auth/state.json

# ─── CheckMK Integration ──────────────────────────────────────
CHECKMK_URL=https://checkmk.yourcompany.com
CHECKMK_SITE=monitoring
CHECKMK_USERNAME=automation
CHECKMK_SECRET=your-automation-secret
CHECKMK_HOST_NAME=playwright-synthetic
CHECKMK_FOLDER=/synthetic-monitoring

# ─── RunDeck ──────────────────────────────────────────────────
RUNDECK_URL=http://rundeck.yourcompany.com:4440
RUNDECK_TOKEN=your-rundeck-api-token
RUNDECK_PROJECT=synthetic-monitoring

# ─── Thresholds ───────────────────────────────────────────────
THRESHOLD_LOGIN_MS=5000
THRESHOLD_PAGE_LOAD_MS=8000
THRESHOLD_API_RESPONSE_MS=2000
THRESHOLD_REPORT_LOAD_MS=15000
```

**Per-site env files** (used by the orchestrator for 80+ sites):
```
.env.sites/
  us-east-01.env
  us-east-02.env
  eu-west-01.env
  ...
```
Each file follows the same format as `.env` above.

---

### Sites Registry

Edit `config/sites.config.ts` to register all monitored sites:

```typescript
// Each site entry:
site(
  'us-east-01',           // Site ID
  'New York HQ',          // Display name
  'us-east',              // Group
  'us',                   // Region
  'https://erp-ny.example.com',      // ERP base URL
  'https://api-ny.example.com',      // Middleware base URL
  'https://reports-ny.example.com',  // SSRS base URL
  ['erp', 'ssrs']         // Tags
)
```

Credentials are resolved from environment variables automatically:
- `{SITE_ID}_ERP_USER` / `{SITE_ID}_ERP_PASS`
- Falls back to global `ERP_USERNAME` / `ERP_PASSWORD`

---

### Thresholds

Edit `config/thresholds.ts` to tune warn/critical ms values:

```typescript
export const THRESHOLDS = {
  pageLoad:         { warn: 5_000,  crit: 8_000  },
  loginSuccess:     { warn: 3_000,  crit: 5_000  },
  landingLoad:      { warn: 5_000,  crit: 10_000 },
  workflowNavigate: { warn: 5_000,  crit: 10_000 },
  apiHealth:        { warn: 1_000,  crit: 3_000  },
  ssrsReportLoad:   { warn: 10_000, crit: 20_000 },
  invoiceReprint:   { warn: 8_000,  crit: 15_000 },
};
```

---

## Test Suites

| File | Journey | Key Checks |
|---|---|---|
| `login.spec.ts` | Login page → credentials → dashboard | Page 200, form visible, redirect, nav element, perf thresholds |
| `landing.spec.ts` | Dashboard after login | Load time, KPI widgets, nav links, JS errors, back/forward |
| `core-workflows.spec.ts` | Sales/Purchase/Inventory/Finance modules | Module page 200, search, new form, pagination |
| `reports.spec.ts` | SSRS server health + Invoice reprint | Server 200, report loads, PDF export, ERP reprint flow |
| `middleware-api.spec.ts` | Middleware API health | Health 200, body OK, auth token, business endpoints, P95, SSL |
| `devices.spec.ts` | Device management + Integration hub | Device list, status badges, connector state |

**Graceful degradation**: tests skip automatically when the feature doesn't apply
(e.g. no SSRS configured → SSRS tests skip; no dedicated middleware → API business endpoint tests skip).

---

## Running Tests

### Single site (local)
```bash
# Run all suites against the site in .env
npx playwright test --project=setup --project=synthetic-chromium

# Run a specific suite
npx playwright test tests/synthetic/login.spec.ts

# Run with visible browser
HEADLESS=false npx playwright test

# Show HTML report
npx playwright show-report reports/html
```

### All 80+ sites (orchestrated)
```bash
# Full parallel run (reads config/sites.config.ts)
npm run monitor:all

# Dry-run — validates config, no browsers
npm run monitor:dry-run

# Local cron scheduler (no RunDeck required)
npm run monitor:schedule
```

---

## CheckMK Pro Integration

### Initial Setup

1. Set `CHECKMK_URL`, `CHECKMK_SITE`, `CHECKMK_USERNAME`, `CHECKMK_SECRET` in `.env`
2. Run the setup script to create hosts for all sites:
   ```bash
   npm run setup:checkmk
   ```
   This creates one CheckMK host per site following the pattern `pw-<site-id>`.

3. Activate changes in CheckMK after setup completes.

### How It Works

- The custom reporter (`lib/reporters/checkmk-reporter.ts`) reads `checkmk-perf` annotations from each test
- After every test run, results are pushed as **passive checks** via CheckMK REST API
- Each metric (login time, dashboard load, API health, etc.) becomes a separate service in CheckMK
- States: OK / WARN / CRIT based on configured thresholds

### CheckMK Service Naming

```
pw-us-east-01 / Playwright_login_time        → OK (1234ms)
pw-us-east-01 / Playwright_dashboard_load    → WARN (6500ms)
pw-us-east-01 / Playwright_mw_health         → OK (230ms)
```

### Host Pattern
```
CheckMK folder:  /synthetic-monitoring/
Host name:       pw-<site-id>   (e.g. pw-us-east-01)
```

---

## RunDeck Integration

### Import Jobs

1. Open RunDeck → your project → Jobs → Import
2. Upload `rundeck/job-definition.xml`
3. Five jobs are created:

| Job | Schedule | Scope |
|---|---|---|
| `synthetic-global` | Every 5 min | All 80+ sites |
| `synthetic-regional-us` | Every 5 min | US sites only |
| `synthetic-regional-eu` | Every 5 min | EU sites only |
| `synthetic-api-quick` | Every 2 min | API health checks only |
| `synthetic-cleanup` | Daily | Purge old reports |

### Job Configuration

Each job calls `scripts/run-monitoring.sh` with:
```bash
SITE_GROUP=us-east WORKERS=4 bash scripts/run-monitoring.sh
```

Set these RunDeck options in the job definition:
- `RUNDECK_URL` — your RunDeck server
- `RUNDECK_TOKEN` — API token with job execution rights
- `RUNDECK_PROJECT` — project name

### Triggering Manually

```bash
# Via RunDeck API
curl -X POST \
  -H "X-Rundeck-Auth-Token: $RUNDECK_TOKEN" \
  "$RUNDECK_URL/api/42/job/JOB_ID/run"
```

---

## Playwright MCP

The Playwright MCP server allows Claude AI (Desktop / Cursor / API) to control a real browser
for interactive debugging and exploratory testing.

### Start the MCP Server

```bash
# HTTP mode (recommended — connect any MCP client)
npm run mcp:server:http
# → listening on http://localhost:8931

# stdio mode (for direct process connections)
npm run mcp:server
```

### Connect Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--port", "8931"]
    }
  }
}
```

### Connect Cursor

Settings → MCP → add server:
```json
{
  "name": "playwright",
  "url": "http://localhost:8931"
}
```

### MCP Config Files
- `mcp/playwright-mcp-config.json` — MCP server settings
- `.vscode/mcp.json` — VS Code / Cursor integration

---

## Consolidated Reporting

After each run a consolidated HTML dashboard is generated at `reports/consolidated/index.html`.
It auto-refreshes every 5 minutes.

```bash
# Serve the dashboard locally
npm run report:serve
# → http://localhost:3000
```

Report structure:
```
reports/
  consolidated/
    index.html          ← live dashboard (auto-refresh 5 min)
  html/                 ← per-run Playwright HTML reports
  json/                 ← per-run machine-readable results
  artifacts/            ← screenshots, videos, traces on failure
  blob/                 ← raw blob outputs
```

---

## Supported Demo Sites

The framework has been tested and verified against:

| App | URL | User | Notes |
|---|---|---|---|
| **OrangeHRM** | `https://opensource-demo.orangehrmlive.com` | `Admin` / `admin123` | 19 pass, 18 skip — fully working |
| **Dolibarr ERP** | `https://demo.dolibarr.org` | `demo` / `Demodemodemo123-` | Requires `LOGIN_PREFLIGHT_URL=/public/demo/` |

**OrangeHRM `.env` settings:**
```bash
SITE_ID=orangehrm-demo
BASE_URL=https://opensource-demo.orangehrmlive.com
ERP_USERNAME=Admin
ERP_PASSWORD=admin123
LOGIN_PATH=/web/index.php/auth/login
LOGIN_PREFLIGHT_URL=
MIDDLEWARE_BASE_URL=https://opensource-demo.orangehrmlive.com
MIDDLEWARE_HEALTH_ENDPOINT=/web/index.php/auth/login
```

**Dolibarr `.env` settings:**
```bash
SITE_ID=dolibarr-demo
BASE_URL=https://demo.dolibarr.org
ERP_USERNAME=demo
ERP_PASSWORD=Demodemodemo123-
LOGIN_PATH=/index.php?urlfrom=%2Fpublic%2Fdemo%2Findex.php&disablemodules=adherent,barcode,bom,cashdesk,don,expedition,externalsite,ftp,incoterm,mailmanspip,margin,mrp,prelevement,product,productbatch,stock,takepos
LOGIN_PREFLIGHT_URL=/public/demo/
MIDDLEWARE_BASE_URL=https://demo.dolibarr.org
MIDDLEWARE_HEALTH_ENDPOINT=/index.php
```

---

## Troubleshooting

### Auth setup lands on dashboard instead of login form
**Cause:** Stored session in `.auth/state.json` is inherited by the browser context.
**Fix:** The `auth.setup.ts` calls `clearCookies()` automatically. If it persists, delete `.auth/state.json` and re-run.

### Demo site redirects to a profile selector instead of login form
**Cause:** Some demo instances (e.g. Dolibarr) require a pre-visit to initialize a PHP session.
**Fix:** Set `LOGIN_PREFLIGHT_URL=/public/demo/` in `.env`.

### SSRS tests all skip
**Cause:** `SSRS_BASE_URL` contains `example.com` (default placeholder).
**Fix:** Set a real `SSRS_BASE_URL` in `.env`.

### Middleware business endpoint tests skip
**Cause:** `MIDDLEWARE_BASE_URL` is the same host as `BASE_URL` (no dedicated API server).
**Fix:** Set a real separate `MIDDLEWARE_BASE_URL` pointing to your API server.

### TypeScript compile errors
```bash
npx tsc --noEmit
```
Fix any reported errors before running tests. Strict mode is enabled — no `any` types allowed.

### Port 8931 already in use (MCP)
```bash
lsof -i :8931          # find the PID
kill <PID>             # stop it
npm run mcp:server:http  # restart
```

### Tests timing out in CI
Increase timeouts in `playwright.config.ts`:
```typescript
timeout: 90_000,          // per-test timeout
navigationTimeout: 45_000,
actionTimeout: 15_000,
```
Or set `RETRIES=2` in `.env`.

---

## Project Structure

```
PlaywrightPOC/
├── config/
│   ├── sites.config.ts        # 80+ site registry
│   └── thresholds.ts          # warn/crit ms values
├── lib/
│   └── reporters/
│       ├── checkmk-reporter.ts       # CheckMK passive check pusher
│       └── consolidated-reporter.ts  # HTML dashboard generator
├── mcp/
│   ├── playwright-mcp-config.json
│   └── README.md
├── reports/
│   ├── consolidated/index.html
│   ├── html/
│   ├── json/
│   └── artifacts/
├── rundeck/
│   └── job-definition.xml     # 5 RunDeck job definitions
├── scripts/
│   ├── run-all-sites.js       # parallel orchestrator
│   └── run-monitoring.sh      # RunDeck entry point
├── tests/
│   ├── auth.setup.ts          # session auth (runs before suites)
│   ├── global-setup.ts        # directory init, run ID
│   ├── global-teardown.ts
│   ├── fixtures/
│   │   └── base.ts            # erpPage, ssrsPage, siteContext, measure
│   └── synthetic/
│       ├── login.spec.ts
│       ├── landing.spec.ts
│       ├── core-workflows.spec.ts
│       ├── reports.spec.ts
│       ├── middleware-api.spec.ts
│       └── devices.spec.ts
├── .env                       # active site config (gitignored)
├── .env.example               # template
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

---

## Quick Start Checklist

- [ ] `npm install && npx playwright install chromium`
- [ ] Copy `.env.example` → `.env`, fill in your ERP URL + credentials
- [ ] `npm run monitor:dry-run` — verify config loads cleanly
- [ ] `npx playwright test --project=setup` — verify auth works
- [ ] `npx playwright test` — run full suite, check results
- [ ] Set `CHECKMK_URL` + `CHECKMK_SECRET` → `npm run setup:checkmk`
- [ ] Import `rundeck/job-definition.xml` → activate 5-min schedule
- [ ] `npm run report:serve` → view dashboard at `http://localhost:3000`
- [ ] `npm run mcp:server:http` → connect Claude/Cursor MCP client

---

*Built with [Playwright](https://playwright.dev) · Monitored by [CheckMK](https://checkmk.com) · Scheduled by [RunDeck](https://www.rundeck.com)*
