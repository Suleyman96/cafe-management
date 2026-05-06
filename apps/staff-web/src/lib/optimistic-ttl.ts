import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Default TTL for an optimistic patch. Server P95 + realtime broadcast +
 * network jitter is well under 10s; if onSettled hasn't fired by then the
 * mutation is genuinely orphaned (silent network death, tab backgrounded
 * mid-flight) and the patch must be reverted by refetching truth.
 */
const DEFAULT_TTL_MS = 10_000;

/**
 * Schedule a fallback invalidation that fires only if the caller doesn't
 * cancel it first. The returned cancel fn is intended for `onSettled` so
 * the happy path keeps its existing settled→invalidate flow.
 *
 * The timer is registered against the QueryClient (a singleton) and runs
 * regardless of which component issued the mutation. That's the point —
 * onMutate/onSettled live on the mutation's own lifecycle, but if the
 * mutation observer is GC'd or the network silently drops we still need
 * the cache to converge on the server's truth.
 */
export function withOptimisticTtl(
  queryClient: QueryClient,
  keys: QueryKey[],
  ms: number = DEFAULT_TTL_MS,
): () => void {
  const timer = setTimeout(() => {
    for (const key of keys) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  }, ms);
  return () => {
    clearTimeout(timer);
  };
}
