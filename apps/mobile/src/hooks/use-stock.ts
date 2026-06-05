import { validateOrThrow } from '@gustri/core';
import { StockAdjustInputSchema } from '@gustri/database/schemas/inputs';
import type { StockItemUpdate } from '@gustri/database/types';
import { QUERY_KEYS, tenantKey, useDb, useTenantId } from '@gustri/queries';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';
import { getOrCreateClientRequestId } from '@/lib/idempotency';
import { MUTATION_KEYS } from '@/lib/mutation-keys';

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
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: MUTATION_KEYS.UPDATE_STOCK_ITEM,
    mutationFn: ({ id, data }: { id: string; data: StockItemUpdate }) =>
      db.stockItems.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.STOCK_ITEMS) });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.LOW_STOCK_COUNT) });
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
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    // Stock adjustments are inventory-of-record writes. Queueing them creates
    // ordering ambiguity (out-of-stock checks may use the wrong number) and
    // amplifies retry conflicts. Fail loudly online, refuse offline.
    //
    // We still stamp `clientRequestId` so an in-flight retry (request sent,
    // response dropped) hits the server's dedupe path and doesn't apply the
    // adjustment twice.
    networkMode: 'always',
    retry: 0,
    onMutate: (variables: {
      id: string;
      data: {
        type: 'in' | 'out' | 'adjustment';
        quantity: number;
        reason?: string;
        performedBy?: string;
        clientRequestId?: string;
      };
    }) => {
      variables.data.clientRequestId = getOrCreateClientRequestId(variables.data.clientRequestId);
    },
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
        clientRequestId?: string;
      };
    }) => {
      // Invariant: `onMutate` above stamps `clientRequestId`. Re-minting
      // silently would bypass the server's dedupe path on a network retry.
      if (!data.clientRequestId) {
        throw new Error('adjustStock: clientRequestId missing — onMutate must run first');
      }
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
        client_request_id: input.clientRequestId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.STOCK_ITEMS) });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.STOCK_MOVEMENTS) });
    },
    onError: (error: Error) => {
      Sentry.captureException(error, { extra: { context: 'adjustStock' } });
    },
  });
}
