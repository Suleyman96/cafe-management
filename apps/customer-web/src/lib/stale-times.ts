/**
 * Cache-tier policy for customer-web.
 *
 * Re-exports the shared `STALE_TIMES` from @gustri/queries so the app uses one
 * source of truth (this was a local duplicate). Importers keep using
 * `@/lib/stale-times`; the values now live alongside the shared query hooks.
 */
export { STALE_TIMES } from '@gustri/queries';
