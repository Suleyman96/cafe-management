import type { StockItemInsert, StockItemUpdate } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateStock } from '../invalidation';
import { useDb } from '../provider';
import type { MutationCallbacks } from './types';

export function useCreateStockItem(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StockItemInsert) => db.stockItems.create(data),
    onSuccess: () => {
      invalidateStock(queryClient);
    },
    onError: options?.onError,
  });
}

export function useUpdateStockItem(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<StockItemUpdate> }) =>
      db.stockItems.update(id, updates),
    onSuccess: () => {
      invalidateStock(queryClient);
    },
    onError: options?.onError,
  });
}

export function useDeleteStockItem(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.stockItems.delete(id),
    onSuccess: () => {
      invalidateStock(queryClient);
    },
    onError: options?.onError,
  });
}
