/**
 * Type-Safe Stock Hooks
 * Re-exports from @gustri/queries, with local override for apiRoutes mutation
 */

import { useTenantId } from '@gustri/queries';
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

// Local: uses apiRoutes for server-side stock adjustment
export function useAdjustStock() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        type: 'in' | 'out' | 'adjustment';
        quantity: number;
        reason?: string;
        performedBy?: string;
      };
    }) =>
      apiRoutes.stock.adjust(id, {
        movement_type: data.type,
        quantity_change: data.quantity,
        reason: data.reason || '',
        performed_by: data.performedBy || '',
      }),
    onSuccess: () => {
      invalidateStock(queryClient, tenantId, true);
    },
  });
}
