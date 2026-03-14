import * as fs from 'fs';
import * as path from 'path';

async function globalSetup() {
  // Ensure output directories exist
  const dirs = [
    '.auth',
    'reports/json',
    'reports/html',
    'reports/consolidated',
    'reports/artifacts',
    'reports/blob',
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const runId = `${process.env.SITE_ID || 'default'}-${Date.now()}`;
  process.env.RUN_ID = runId;

  console.log(`\n[MONITOR] Starting run: ${runId}`);
  console.log(`[MONITOR] Site: ${process.env.SITE_ID || 'default'} | ${process.env.SITE_NAME || ''}`);
  console.log(`[MONITOR] ERP: ${process.env.BASE_URL}`);
  console.log(`[MONITOR] Middleware: ${process.env.MIDDLEWARE_BASE_URL}`);
}

export default globalSetup;
