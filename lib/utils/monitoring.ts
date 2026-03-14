/**
 * Shared monitoring utilities used across test files and scripts.
 */
import * as fs   from 'fs';
import * as path from 'path';

/** Simple structured logger for monitoring runs */
export class MonitorLogger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = `[${prefix}]`;
  }

  info(msg: string):  void { console.log(`${this.prefix}  ${msg}`); }
  warn(msg: string):  void { console.warn(`${this.prefix} ⚠ ${msg}`); }
  error(msg: string): void { console.error(`${this.prefix} ✗ ${msg}`); }
  ok(msg: string):    void { console.log(`${this.prefix} ✓ ${msg}`); }
}

/** Append a check result to a JSONL file (for streaming aggregation) */
export function appendResult(
  filePath: string,
  record: Record<string, unknown>,
): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf8');
}

/** Read all JSONL results from a directory and combine */
export function aggregateResults(dir: string): unknown[] {
  if (!fs.existsSync(dir)) return [];
  const lines: unknown[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const line of raw.split('\n').filter(Boolean)) {
      try { lines.push(JSON.parse(line)); } catch { /* skip */ }
    }
  }
  return lines;
}

/** Format milliseconds as human-readable string */
export function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Clamp a value between min and max */
export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/** Build a CheckMK-compatible performance data string */
export function buildPerfString(entries: Array<{
  name: string;
  value: number;
  warn?: number;
  crit?: number;
  unit?: string;
}>): string {
  return entries
    .map(e => {
      const unit = e.unit || 'ms';
      const w    = e.warn  ?? '';
      const c    = e.crit  ?? '';
      return `${e.name}=${e.value}${unit};${w};${c};;`;
    })
    .join(' ');
}

/** Returns ISO timestamp suitable for filenames (no colons) */
export function fileTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
