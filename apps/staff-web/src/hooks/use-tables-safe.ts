/**
 * Type-Safe Tables Hooks
 * Re-exports from @gustri/queries, with local overrides for app-specific logic
 */

import type { Database } from '@gustri/database';
import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { withOptimisticTtl } from '@/lib/optimistic-ttl';
import { db } from '@/lib/supabase/wrapped-client';

type TableRow = Database['public']['Tables']['tables']['Row'];
type TableStatus = TableRow['status'];

// Re-export shared hooks. The table-cap check that used to live here as
// a soft pre-check now lives entirely server-side: a BEFORE INSERT
// trigger on `tables` raises the `plan_required` sentinel, which
// `handleSupabaseError` maps to an AuthorizationError and the mutation
// cache's `onError` localizes via `localizeErrorMessage`.
export {
  useCreateTable,
  useDeleteTable,
  useTable,
  useTableByQrCode,
  useTables,
  useUpdateTable,
} from '@gustri/queries';

// Local override: optimistic updates + different param shape ({ tableId } vs { id })
export function useUpdateTableStatus() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ tableId, status }: { tableId: string; status: TableStatus }) =>
      db.tables.updateStatus(tableId, status),
    onMutate: async ({ tableId, status }) => {
      await queryClient.cancelQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TABLES) });

      const previousTables = queryClient.getQueryData(tenantKey(tenantId, QUERY_KEYS.TABLES));

      queryClient.setQueryData(
        tenantKey(tenantId, QUERY_KEYS.TABLES),
        (old: TableRow[] | undefined) => old?.map((t) => (t.id === tableId ? { ...t, status } : t)),
      );

      // Zombie-patch killer: if onSettled never fires (silent network drop,
      // tab backgrounded mid-flight) the optimistic patch above is reverted
      // by a forced invalidate after the TTL.
      const cancelTtl = withOptimisticTtl(queryClient, [
        tenantKey(tenantId, QUERY_KEYS.TABLES),
        tenantKey(tenantId, QUERY_KEYS.ORDERS),
      ]);

      return { previousTables, cancelTtl };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTables) {
        queryClient.setQueryData(tenantKey(tenantId, QUERY_KEYS.TABLES), context.previousTables);
      }
    },
    onSettled: (_data, _err, _vars, context) => {
      context?.cancelTtl?.();
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TABLES) });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS) });
    },
  });
}

// Note: Table transfer functionality is in use-table-transfers-safe.ts
