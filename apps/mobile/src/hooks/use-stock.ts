import { QUERY_KEYS } from '@cafe-idare/core';
import type { StockItemInsert, StockItemUpdate } from '@cafe-idare/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { StockItem, StockMovement } from '@/types';

export function useStockItems(options?: { category?: string; lowStockOnly?: boolean }) {
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_ITEMS, options],
    queryFn: async (): Promise<StockItem[]> => db.stockItems.findAll(options),
  });
}

export function useLowStockCount() {
  return useQuery({
    queryKey: [QUERY_KEYS.LOW_STOCK_COUNT],
    queryFn: async (): Promise<number> => db.stockItems.getLowStockCount(),
  });
}

export function useStockTotalValue() {
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_ITEMS, 'total-value'],
    queryFn: async (): Promise<number> => db.stockItems.getTotalValue(),
  });
}

export function useStockMovements(itemId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_MOVEMENTS, itemId],
    queryFn: async (): Promise<StockMovement[]> => db.stockItems.getMovements(itemId!),
    enabled: !!itemId,
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
    }) => db.stockItems.adjustStock(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STOCK_ITEMS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STOCK_MOVEMENTS] });
    },
    onError: (error: Error) => {
      console.error('Failed to adjust stock:', error.message);
    },
  });
}

export function useCreateStockItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StockItemInsert) => db.stockItems.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STOCK_ITEMS] });
    },
    onError: (error: Error) => {
      console.error('Failed to create stock item:', error.message);
    },
  });
}

export function useUpdateStockItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: StockItemUpdate }) =>
      db.stockItems.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STOCK_ITEMS] });
    },
    onError: (error: Error) => {
      console.error('Failed to update stock item:', error.message);
    },
  });
}

export function useDeleteStockItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.stockItems.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STOCK_ITEMS] });
    },
    onError: (error: Error) => {
      console.error('Failed to delete stock item:', error.message);
    },
  });
}
