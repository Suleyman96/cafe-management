/**
 * Type-Safe Tables Hooks
 * Re-exports from @gustri/queries, with local overrides for app-specific logic
 */

import { PLAN_LIMITS } from '@gustri/core';
import type { Database } from '@gustri/database';
import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { withOptimisticTtl } from '@/lib/optimistic-ttl';
import { db } from '@/lib/supabase/wrapped-client';
import { useAuthStore } from '@/store/auth-store';

type TableRow = Database['public']['Tables']['tables']['Row'];
type TableStatus = TableRow['status'];

// Re-export shared hooks
export {
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

// Local override: includes plan-limit pre-check via useAuthStore
export function useCreateTable() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: async (tableData: Database['public']['Tables']['tables']['Insert']) => {
      // Soft pre-check: verify table limit before sending to DB
      const tables = queryClient.getQueryData<TableRow[]>(tenantKey(tenantId, QUERY_KEYS.TABLES));
      const plan = useAuthStore.getState().tenantPlan ?? 'free';
      const max = PLAN_LIMITS[plan].maxTables;
      if (max !== -1 && (tables?.length ?? 0) >= max) {
        throw new Error(`Your ${plan} plan allows up to ${max} tables. Upgrade to add more.`);
      }
      return db.tables.create(tableData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TABLES) });
    },
  });
}

// Note: Table transfer functionality is in use-table-transfers-safe.ts
