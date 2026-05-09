/**
 * Per-staff kitchen-screen category filter.
 *
 * Read hook returns the category ids the staff has selected. Empty array
 * means "no filter — show all categories" — the kitchen view layer is the
 * single place that interprets that semantic.
 *
 * The mutation hook is intentionally optimistic: a chip click during a
 * lunch rush must feel instant. The realtime echo (postgres_changes on
 * staff_kitchen_filters scoped by staff_id) replaces the optimistic state
 * with the server's canonical view ~150ms later, debounced through
 * REALTIME_INVALIDATE_DEBOUNCE_MS so the round trip never produces a
 * visible flash.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import type { MutationCallbacks } from '../mutations/types';
import { useDb, useTenantId } from '../provider';

export function useStaffKitchenFilters(
  staffId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.STAFF_KITCHEN_FILTERS, staffId),
    queryFn: () => db.staffKitchenFilters.findByStaffId(staffId as string),
    enabled: !!staffId && (options?.enabled ?? true),
    // Filters change rarely; don't refetch aggressively. Realtime + the
    // staff_kitchen_filters subscription keeps us fresh.
    staleTime: 5 * 60 * 1000,
  });
}

export function useReplaceStaffKitchenFilters(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ staffId, categoryIds }: { staffId: string; categoryIds: string[] }) =>
      db.staffKitchenFilters.replace(staffId, categoryIds),
    onMutate: async ({ staffId, categoryIds }) => {
      const queryKey = tenantKey(tenantId, QUERY_KEYS.STAFF_KITCHEN_FILTERS, staffId);
      // Cancel any in-flight refetch so it can't overwrite our optimistic
      // state mid-flight.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<string[]>(queryKey);
      queryClient.setQueryData<string[]>(queryKey, Array.from(new Set(categoryIds)));
      return { previous, queryKey };
    },
    onError: (err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      options?.onError?.(err);
    },
    onSettled: (_data, _err, { staffId }) => {
      // Realtime will deliver the canonical state; the explicit invalidate
      // covers the case where the realtime channel is torn down (tab in
      // background) and the trailing-edge debouncer never fires.
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.STAFF_KITCHEN_FILTERS, staffId),
      });
    },
  });
}
