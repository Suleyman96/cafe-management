import type { Table } from '@gustri/database';
import { QUERY_KEYS, useDb, useTables as useSharedTables } from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MUTATION_KEYS } from '@/lib/mutation-keys';
import { useTenantId } from '@/store/auth-store';

// Re-export single-table read hook (already has its own enabled guard)
export { useTable } from '@gustri/queries';

/**
 * Mobile-local wrapper around the shared `useTables`. Adds an `enabled` guard
 * on tenant_id so the query doesn't fire during the auth-boot window when
 * the staff session has not yet loaded. Without this, the request runs
 * under unready auth context and either fails or returns the wrong tenant's
 * rows during a session transition.
 *
 * Pre-L11 this hook reimplemented `useQuery` to inject the gate; the shared
 * hook now accepts `{ enabled }` directly so the wrapper just forwards.
 */
export function useTables() {
  const tenantId = useTenantId();
  return useSharedTables({ enabled: !!tenantId });
}

// Local mutation — mobile consumers use { tableId, status } instead of { id, status }

export function useUpdateTableStatus() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: MUTATION_KEYS.UPDATE_TABLE_STATUS,
    mutationFn: ({ tableId, status }: { tableId: string; status: Table['status'] }) =>
      db.tables.updateStatus(tableId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
  });
}
