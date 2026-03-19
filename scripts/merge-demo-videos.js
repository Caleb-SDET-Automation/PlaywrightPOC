#!/usr/bin/env node
/**
 * Merge Playwright demo test videos into one file using ffmpeg concat demuxer.
 *
 * Input:  reports/artifacts-demo/<test-output-folder>/video.webm
 * Output: reports/artifacts-demo/merged/demo-suite.webm
 *
 * Requirements:
 *   - ffmpeg installed and on PATH
 *
 * Notes:
 *   - concat demuxer works best when all inputs share codec/params (Playwright does).
 *   - If a test produced no video (very short), it's skipped.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function isDirectory(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function findVideos(rootDir) {
  /** @type {string[]} */
  const videos = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(rootDir, e.name);
    if (!e.isDirectory()) continue;
    const vid = path.join(full, 'video.webm');
    if (exists(vid)) videos.push(vid);
  }

  // Deterministic order: Flow 1..N if present, otherwise alphabetical
  videos.sort((a, b) => {
    const na = path.basename(path.dirname(a));
    const nb = path.basename(path.dirname(b));
    const fa = /Flow-(\d+)/.exec(na)?.[1];
    const fb = /Flow-(\d+)/.exec(nb)?.[1];
    if (fa && fb) return Number(fa) - Number(fb);
    if (fa) return -1;
    if (fb) return 1;
    return na.localeCompare(nb);
  });

  return videos;
}

function shellQuoteForFfmpegFile(p) {
  // ffmpeg concat list uses: file 'path'
  // Escape single quotes by closing/opening with '\'' (POSIX style).
  return `'${p.replace(/'/g, `'\\''`)}'`;
}

function main() {
  const artifactsRoot = path.resolve(process.cwd(), 'reports', 'artifacts-demo');
  if (!isDirectory(artifactsRoot)) {
    die(`No demo artifacts found at ${artifactsRoot}. Run: npm run test:demo`);
  }

  const ffmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (ffmpeg.error) {
    die(
      `ffmpeg not found on PATH.\n` +
      `Install it (macOS): brew install ffmpeg\n` +
      `Then rerun: node scripts/merge-demo-videos.js`
    );
  }

  const videos = findVideos(artifactsRoot);
  if (videos.length === 0) {
    die(`No video.webm files found under ${artifactsRoot}.`);
  }

  const outDir = path.join(artifactsRoot, 'merged');
  fs.mkdirSync(outDir, { recursive: true });
  const listPath = path.join(outDir, 'concat-list.txt');
  const outPath = path.join(outDir, 'demo-suite.webm');

  const lines = videos.map(v => `file ${shellQuoteForFfmpegFile(v)}`).join('\n') + '\n';
  fs.writeFileSync(listPath, lines);

  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    outPath,
  ];

  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (r.status !== 0) {
    die(`ffmpeg failed to merge videos (exit ${r.status}).`);
  }

  console.log(`Merged ${videos.length} videos -> ${path.relative(process.cwd(), outPath)}`);
}

main();

