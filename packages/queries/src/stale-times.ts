/**
 * Shared React Query `staleTime` tiers.
 *
 * One place to tune how long each class of data stays "fresh" before a
 * refetch is allowed. The QueryClient `defaultOptions` already pins a 1-minute
 * floor in every app; these named tiers let individual hooks opt into a
 * longer/shorter window without scattering magic numbers (`5 * 60 * 1000`)
 * across the codebase.
 *
 * Pick by how fast the underlying data actually changes:
 *   - REALTIME  data backed by a Supabase Realtime subscription — the
 *               subscription is the freshness source; staleTime is only the
 *               cold-start / dropped-connection safety net.
 *   - SHORT     operational data that changes during a shift (matches the
 *               global default).
 *   - MEDIUM    semi-static catalog/people data (menu, staff, tenant, reports).
 *   - LONG      rarely-edited config (categories, expense categories).
 *   - STATIC    immutable for the session (e.g. a QR token → tenant mapping).
 */
export const STALE_TIMES = {
  REALTIME: 10 * 1000,
  SHORT: 60 * 1000,
  MEDIUM: 5 * 60 * 1000,
  LONG: 10 * 60 * 1000,
  STATIC: Number.POSITIVE_INFINITY,
} as const;
