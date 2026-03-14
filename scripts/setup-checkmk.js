#!/usr/bin/env node
/**
 * setup-checkmk.js
 * One-time setup: Creates monitoring hosts in CheckMK for all enabled sites.
 *
 * Usage: node scripts/setup-checkmk.js [--folder=/synthetic-monitoring]
 */
'use strict';

const path = require('path');
const fs   = require('fs');

// Load environment
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const [k, ...rest] = line.split('=');
    if (k && !k.startsWith('#') && rest.length) {
      process.env[k.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

if (!process.env.CHECKMK_URL || !process.env.CHECKMK_SECRET) {
  console.error('Error: CHECKMK_URL and CHECKMK_SECRET must be set in .env');
  process.exit(1);
}

// Dynamic import using ts-node
require('ts-node').register({ project: path.resolve(__dirname, '../tsconfig.json') });

const { SITES }          = require('../config/sites.config.ts');
const { CheckMKClient }  = require('../lib/checkmk/client.ts');

const args   = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const folder = args.folder || process.env.CHECKMK_FOLDER || '/synthetic-monitoring';

(async () => {
  const client  = CheckMKClient.fromEnv();
  const enabled = SITES.filter(s => s.enabled);

  console.log(`\nSetting up ${enabled.length} monitoring hosts in CheckMK...`);
  console.log(`Folder: ${folder}\n`);

  let created = 0;
  let skipped = 0;
  let errors  = 0;

  for (const site of enabled) {
    const hostName = site.checkmk.hostName;
    try {
      await client.ensureHostExists(hostName, folder);
      console.log(`  ✓ ${hostName.padEnd(30)} ${site.name}`);
      created++;
    } catch (err) {
      console.error(`  ✗ ${hostName.padEnd(30)} ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone: ${created} created/verified, ${errors} errors`);
  if (errors > 0) process.exit(1);
})();
