/**
 * Performance & health thresholds used across all monitoring tests.
 * Values are in milliseconds unless stated otherwise.
 */

export interface Threshold {
  warn: number;   // CheckMK WARNING state
  crit: number;   // CheckMK CRITICAL state
}

export const THRESHOLDS = {
  // User journey timings
  loginSuccess:      { warn: 4_000,  crit: 8_000  } as Threshold,
  pageLoad:          { warn: 6_000,  crit: 12_000 } as Threshold,
  landingLoad:       { warn: 5_000,  crit: 10_000 } as Threshold,

  // Core workflow timings
  workflowNavigate:  { warn: 3_000,  crit: 6_000  } as Threshold,
  workflowSave:      { warn: 5_000,  crit: 10_000 } as Threshold,
  searchResults:     { warn: 4_000,  crit: 8_000  } as Threshold,

  // Reports / SSRS
  ssrsReportLoad:    { warn: 10_000, crit: 30_000 } as Threshold,
  invoiceReprint:    { warn: 8_000,  crit: 20_000 } as Threshold,
  reportExport:      { warn: 15_000, crit: 45_000 } as Threshold,

  // API / Middleware
  apiHealth:         { warn: 1_000,  crit: 3_000  } as Threshold,
  apiResponse:       { warn: 2_000,  crit: 5_000  } as Threshold,
  authToken:         { warn: 2_000,  crit: 5_000  } as Threshold,

  // Device management
  deviceList:        { warn: 4_000,  crit: 8_000  } as Threshold,
  deviceAction:      { warn: 5_000,  crit: 12_000 } as Threshold,

  // Integration
  integrationSync:   { warn: 10_000, crit: 30_000 } as Threshold,
};

/** Evaluate a duration against a threshold and return CheckMK state */
export function evaluateThreshold(duration: number, threshold: Threshold): 0 | 1 | 2 {
  if (duration >= threshold.crit) return 2; // CRITICAL
  if (duration >= threshold.warn) return 1; // WARNING
  return 0;                                  // OK
}

/** Format a perf-data string for CheckMK */
export function perfData(
  label: string,
  value: number,
  threshold: Threshold,
  unit = 'ms',
): string {
  return `${label}=${value}${unit};${threshold.warn};${threshold.crit};;`;
}
