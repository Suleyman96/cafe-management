import { QUERY_KEYS, validateOrThrow } from '@gustri/core';
import { StockAdjustInputSchema, type StockItemUpdate } from '@gustri/database';
import { useDb } from '@gustri/queries';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';

// Re-export hooks and mutations with matching param shapes
export {
  useCreateStockItem,
  useDeleteStockItem,
  useLowStockCount,
  useStockItems,
} from '@gustri/queries';

// Local useStockMovements — accepts string | undefined (shared requires string)
export function useStockMovements(stockItemId: string | undefined) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_MOVEMENTS, stockItemId],
    queryFn: () => db.stockItems.getMovements(stockItemId!),
    enabled: !!stockItemId,
  });
}

// Local mutation — mobile consumers use { id, data } instead of { id, updates }
export function useUpdateStockItem() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: StockItemUpdate }) =>
      db.stockItems.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STOCK_ITEMS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LOW_STOCK_COUNT] });
    },
  });
}

// Local hooks — not available in shared package

export function useStockTotalValue() {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_ITEMS, 'total-value'],
    queryFn: async (): Promise<number> => db.stockItems.getTotalValue(),
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();

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
    }) => {
      const input = validateOrThrow(
        StockAdjustInputSchema,
        { id, ...data },
        'Invalid stock adjustment',
      );
      return apiRoutes.stock.adjust(input.id, {
        movement_type: input.type,
        quantity_change: input.quantity,
        reason: input.reason ?? '',
        performed_by: input.performedBy ?? '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STOCK_ITEMS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STOCK_MOVEMENTS] });
    },
    onError: (error: Error) => {
      Sentry.captureException(error, { extra: { context: 'adjustStock' } });
    },
  });
}
