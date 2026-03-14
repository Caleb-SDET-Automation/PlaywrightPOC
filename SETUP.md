# Playwright Synthetic Monitoring — Complete Setup Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     RunDeck Scheduler                    │
│              (triggers every 5–7 minutes)                │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              run-monitoring.sh / run-all-sites.js        │
│        Orchestrator: spawns N parallel site runners      │
│              Concurrency: up to 10 sites at once         │
└────┬──────────┬──────────┬──────────┬──────────┬────────┘
     │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼
  Site-001   Site-002   Site-003  ... Site-080+
  Playwright Playwright Playwright    Playwright
  Test Run   Test Run   Test Run      Test Run
     │          │          │              │
     └──────────┴──────────┴──────────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
        CheckMK Pro      Consolidated
        Passive Checks   HTML Report
        (per service)    (all sites)
```

## Test Journey Coverage

| Journey              | File                        | Checks                                   |
|----------------------|-----------------------------|------------------------------------------|
| Login → Dashboard    | `tests/synthetic/login.spec.ts`         | Login form, credentials, redirect, nav  |
| Landing / Dashboard  | `tests/synthetic/landing.spec.ts`       | KPI widgets, nav links, JS errors        |
| Core Workflows       | `tests/synthetic/core-workflows.spec.ts`| Sales, Purchase, Inventory, Finance      |
| Reports / SSRS       | `tests/synthetic/reports.spec.ts`       | SSRS server, Invoice report, Reprint     |
| Middleware API       | `tests/synthetic/middleware-api.spec.ts`| Health 200, Auth, Business endpoints     |
| Devices / Integration| `tests/synthetic/devices.spec.ts`       | Device list, status, Integration hub     |

---

## 1. Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- Linux/macOS server with internet access to all monitored sites
- **CheckMK Pro** instance (for passive check integration)
- **RunDeck** 4.x or later

---

## 2. Installation

```bash
# Clone / deploy the project
git clone <repo-url> /opt/playwright-monitor
cd /opt/playwright-monitor

# Install dependencies
npm ci

# Install Playwright browsers
npx playwright install chromium --with-deps
```

---

## 3. Environment Configuration

```bash
# Copy the example env and fill in your values
cp .env.example .env
nano .env
```

Key variables to set:
```env
# CheckMK Pro
CHECKMK_URL=https://checkmk.yourcompany.com
CHECKMK_SITE=monitoring
CHECKMK_USERNAME=automation
CHECKMK_SECRET=<checkmk-automation-secret>

# Default ERP credentials (overridden per site)
ERP_USERNAME=monitor_user
ERP_PASSWORD=<password>
BASE_URL=https://erp.yourcompany.com
```

### Per-Site Environment Files (optional)

For 80+ sites with different credentials, create `.env.sites/<site-id>.env`:

```bash
mkdir -p .env.sites
cat > .env.sites/us-east-01.env << 'EOF'
SITE_ID=us-east-01
SITE_NAME=New York HQ
BASE_URL=https://erp-ny.yourcompany.com
ERP_USERNAME=ny_monitor
ERP_PASSWORD=secret123
MIDDLEWARE_BASE_URL=https://api-ny.yourcompany.com
SSRS_BASE_URL=https://reports-ny.yourcompany.com/ReportServer
EOF
```

---

## 4. Update Sites Config

Edit `config/sites.config.ts` and replace placeholder URLs with your real endpoints:

```typescript
site('us-east-01', 'New York HQ', 'us-east', 'us',
  'https://erp-ny.yourcompany.com',   // ← real ERP URL
  'https://api-ny.yourcompany.com',   // ← real middleware URL
  'https://reports-ny.yourcompany.com/ReportServer', // ← real SSRS URL
),
```

Set `enabled: false` for any sites not yet live.

---

## 5. CheckMK Pro Setup

### 5a. Create Automation User

In CheckMK Pro:
1. **Setup → Users → Add User**
2. Username: `automation`
3. Roles: `Administrator`
4. Enable **Automation secret**
5. Copy the secret to `CHECKMK_SECRET` in `.env`

### 5b. Initialize Monitoring Hosts

```bash
# Creates a CheckMK host entry for every enabled site
node scripts/setup-checkmk.js --folder=/synthetic-monitoring
```

### 5c. CheckMK Service Rules

In CheckMK Pro, configure passive check acceptance:
1. **Setup → Monitoring Configuration → Passive Checks**
2. Enable passive checks for hosts matching `pw-*`
3. The reporter submits one service per test case automatically

### 5d. CheckMK Dashboard

Create a custom dashboard:
1. **Dashboards → Add Dashboard**
2. Add **Service List** dashlet, filter host tag: `synthetic-monitoring`
3. Add **Tactical Overview** for overall health

---

## 6. RunDeck Setup

### 6a. Install RunDeck (Ubuntu/Debian)

```bash
curl -s https://packagecloud.io/install/repositories/pagerduty/rundeck/script.deb.sh | sudo bash
sudo apt-get install rundeck
sudo systemctl enable --now rundeckd
```

### 6b. Create Project

```bash
# Via RunDeck CLI (rd)
rd projects create --project synthetic-monitoring \
  --file rundeck/project.properties
```

Or via UI: **Projects → New Project → Name: synthetic-monitoring**

### 6c. Import Jobs

```bash
rd jobs load \
  --project synthetic-monitoring \
  --file rundeck/job-definition.xml \
  --format xml
```

Or via UI: **Jobs → Upload → Select rundeck/job-definition.xml**

### 6d. Configure Node

Ensure a node named `playwright-monitor-node` is registered pointing to the server running Playwright.

Edit `rundeck/nodes.yaml` with the actual hostname/IP.

### 6e. Set Environment Variables in RunDeck

In **Project Settings → Key Storage**, add:
- `keys/playwright/checkmk-secret` → your CheckMK secret
- `keys/playwright/erp-password`   → default ERP password

Reference in job definitions as `${keys/playwright/checkmk-secret}`.

---

## 7. Playwright MCP Integration

### For Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "env": { "PLAYWRIGHT_HEADLESS": "false" }
    }
  }
}
```

Restart Claude Desktop. You can now ask Claude to:
- *"Navigate to the ERP login page and take a screenshot"*
- *"Check if the health endpoint returns 200"*
- *"Log in and tell me what's on the dashboard"*

### For VS Code (Copilot / GitHub Copilot)

The `.vscode/mcp.json` file is already configured. Enable MCP in VS Code settings:
```json
"chat.mcp.enabled": true
```

---

## 8. Running Manually

```bash
# Run all sites
npm run monitor:all

# Run single site
SITE_ID=us-east-01 BASE_URL=https://erp-ny.example.com npm test

# Run specific test suite
npm run test:login
npm run test:api
npm run test:reports

# Open last HTML report
npm run report:open
```

---

## 9. Consolidated Reports

Reports are written to `reports/consolidated/`:

| File                    | Description                       |
|-------------------------|-----------------------------------|
| `index.html`            | Auto-refreshing HTML dashboard    |
| `summary.json`          | Machine-readable run summary      |
| `orchestrator-summary.json` | Per-site pass/fail counts    |

The HTML dashboard auto-refreshes every 5 minutes. Serve it via nginx/Apache or open locally.

---

## 10. Monitoring Schedule (5–7 minute intervals)

| Job                          | Schedule       | Scope                |
|------------------------------|----------------|----------------------|
| Global All Sites             | Every 5 min    | All 80+ sites        |
| US East                      | Every 5 min    | US East region       |
| Europe                       | Every 5 min    | All EU regions       |
| API Quick Check              | Every 2 min    | API endpoints only   |
| Report Cleanup               | Daily 02:00    | Remove old reports   |

To change interval, edit the `<crontab>` in `rundeck/job-definition.xml`:
```xml
<!-- Every 5 minutes -->
<crontab>0 */5 * * * ? *</crontab>

<!-- Every 7 minutes -->
<crontab>0 */7 * * * ? *</crontab>
```

---

## 11. Thresholds & Alerting

Thresholds are defined in `config/thresholds.ts`. Adjust warn/crit values to match your SLAs:

```typescript
loginSuccess: { warn: 4_000, crit: 8_000 },   // ms
ssrsReportLoad: { warn: 10_000, crit: 30_000 },
apiHealth: { warn: 1_000, crit: 3_000 },
```

CheckMK automatically triggers alerts when passive check state is CRITICAL.

---

## 12. Troubleshooting

| Issue | Solution |
|-------|----------|
| `Auth state not found` | Run `npm run test:login` once per site to create `.auth/state-<site>.json` |
| `CheckMK 401` | Verify `CHECKMK_USERNAME` and `CHECKMK_SECRET` |
| `SSRS 401` | Check `SSRS_USERNAME`/`SSRS_PASSWORD`, ensure Windows Auth enabled |
| Browser not found | Run `npx playwright install chromium --with-deps` |
| RunDeck job not found | Re-import `rundeck/job-definition.xml` |
| Site selectors wrong | Inspect your ERP's actual DOM and update selectors in test files |
