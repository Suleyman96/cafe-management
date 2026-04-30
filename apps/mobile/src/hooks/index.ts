/**
 * Backwards-compat barrel — `from '@/hooks'` continues to resolve. Prefer
 * the explicit barrels at the import site so it's obvious whether a hook
 * is shared (`@gustri/queries` re-export) or mobile-local (wrapper / native
 * side effects):
 *
 *   import { useFeedback } from '@/hooks/shared';   // straight from @gustri/queries
 *   import { useOrders } from '@/hooks/local';      // mobile wrapper (realtime, sound)
 */
export * from './local';
export * from './shared';
