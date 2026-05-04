/**
 * Type-Safe Stock Hooks
 * Re-exports from @gustri/queries, with local override for apiRoutes mutation
 */

import { getOrCreateClientRequestId, useTenantId } from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';
import { invalidateStock } from '@/lib/query-helpers';

// Re-export shared hooks
export {
  useCreateStockItem,
  useDeleteStockItem,
  useLowStockCount,
  useStockItem,
  useStockItems,
  useStockMovements,
  useUpdateStockItem,
} from '@gustri/queries';

type AdjustStockInput = {
  id: string;
  data: {
    type: 'in' | 'out' | 'adjustment';
    quantity: number;
    reason?: string;
    performedBy?: string;
    client_request_id?: string;
  };
};

// Local: uses apiRoutes for server-side stock adjustment
export function useAdjustStock() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    // `retry: 0` — stock adjustments mutate inventory; an automatic retry
    // would risk double-deducting. User-driven retries reuse the same
    // client_request_id (stamped below) so the server dedupes via the
    // partial unique index on stock_movements.
    retry: 0,
    onMutate: (input: AdjustStockInput) => {
      input.data.client_request_id = getOrCreateClientRequestId(input.data.client_request_id);
    },
    mutationFn: ({ id, data }: AdjustStockInput) =>
      apiRoutes.stock.adjust(id, {
        movement_type: data.type,
        quantity_change: data.quantity,
        reason: data.reason || '',
        performed_by: data.performedBy || '',
        client_request_id: getOrCreateClientRequestId(data.client_request_id),
      }),
    onSuccess: () => {
      invalidateStock(queryClient, tenantId, true);
    },
  });
}
