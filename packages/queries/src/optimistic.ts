/**
 * Optimistic-update primitives (ADD-5).
 *
 * High-frequency shift-time mutations — order status, order-item status,
 * waiter-call acknowledge, table status — felt laggy because the UI only
 * updated after the network round-trip + cache refetch. These helpers apply
 * the standard TanStack Query optimistic pattern:
 *
 *   onMutate:  cancel in-flight refetches (so a late response can't clobber
 *              the optimistic write), snapshot the affected caches, write the
 *              expected value, and return the snapshot.
 *   onError:   restore the snapshot (rollback).
 *   onSettled: invalidate so the cache reconciles with server truth — also
 *              the path realtime takes ~150-300ms later.
 *
 * They are deliberately key-agnostic: staff-web passes tenant-scoped keys
 * (`tenantKey(...)`) and mobile passes its flat `[QUERY_KEYS.X]` keys, so the
 * same primitive serves both clients. This is distinct from ADR-0001, which
 * governs the *realtime* write path (invalidate-only) — optimistic mutation
 * writes are a separate, user-initiated concern and always reconcile on
 * settle.
 */
import type { QueryClient, QueryKey } from '@tanstack/react-query';

/** Snapshot of cache entries captured before an optimistic write, for rollback. */
export type OptimisticSnapshot = Array<[QueryKey, unknown]>;

/**
 * Optimistically patch every cache entry matching `queryKey` (partial match —
 * covers all filtered variants of a list). Cancels in-flight refetches first
 * (required for any onMutate → setQueryData per the TanStack docs) and returns
 * a snapshot to pass to {@link rollbackQueries}. `updater` is skipped for
 * empty (`null`/`undefined`) cache entries.
 */
export async function patchQueries<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  updater: (data: T) => T,
): Promise<OptimisticSnapshot> {
  await queryClient.cancelQueries({ queryKey });
  const snapshot = queryClient.getQueriesData<T>({ queryKey });
  queryClient.setQueriesData<T>({ queryKey }, (old) => (old == null ? old : updater(old)));
  return snapshot;
}

/** Restore caches captured by {@link patchQueries} (rollback on mutation error). */
export function rollbackQueries(queryClient: QueryClient, snapshots: OptimisticSnapshot): void {
  for (const [key, data] of snapshots) {
    queryClient.setQueryData(key, data);
  }
}
