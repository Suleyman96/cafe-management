import type { QueryClient } from '@tanstack/react-query';

/**
 * Drops every mutation in the cache whose `meta.tenantId`/`meta.staffId`
 * doesn't match the currently-resolved session. Used after the persister
 * hydrates on app start: a paused mutation that was queued by user A on this
 * device must not replay under user B's session, and a paused mutation with
 * no stamp (predates this PR or `useAuthStore` was empty when it was queued)
 * is also discarded since we can't prove its origin.
 *
 * Returns the count of removed mutations so the caller can breadcrumb it.
 */
export function drainMismatchedMutations(
  queryClient: QueryClient,
  current: { tenantId: string; staffId: string } | null,
): number {
  const cache = queryClient.getMutationCache();
  const all = cache.getAll();
  let discarded = 0;

  for (const m of all) {
    const meta = (m.meta ?? {}) as Record<string, unknown>;
    const stampedTenant = typeof meta.tenantId === 'string' ? meta.tenantId : null;
    const stampedStaff = typeof meta.staffId === 'string' ? meta.staffId : null;

    const matches =
      current !== null && stampedTenant === current.tenantId && stampedStaff === current.staffId;

    if (!matches) {
      cache.remove(m);
      discarded++;
    }
  }

  return discarded;
}
