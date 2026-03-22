/**
 * Query configuration for customer-web.
 * QUERY_KEYS are imported from @cafe-idare/core.
 */

/** Stale time presets (ms) */
export const STALE_TIMES = {
  SHORT: 1000 * 60, // 1 minute
  MEDIUM: 1000 * 60 * 5, // 5 minutes
} as const;
