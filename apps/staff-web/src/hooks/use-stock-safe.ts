/**
 * Type-Safe Stock Hooks
 */

import { QUERY_KEYS } from '@gustri/core';
import type { Database } from '@gustri/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';
import { invalidateStock } from '@/lib/query-helpers';
import { db } from '@/lib/supabase/wrapped-client';

type StockItem = Database['public']['Tables']['stock_items']['Row'];
type StockItemInsert = Database['public']['Tables']['stock_items']['Insert'];

export function useStockItems(options?: { category?: string; lowStockOnly?: boolean }) {
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_ITEMS, options],
    queryFn: async (): Promise<StockItem[]> => db.stockItems.findAll(options),
  });
}

export function useStockItem(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_ITEM, id],
    queryFn: async (): Promise<StockItem> => db.stockItems.findById(id),
    enabled: !!id,
  });
}

export function useCreateStockItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StockItemInsert) => db.stockItems.create(data),
    onSuccess: () => {
      invalidateStock(queryClient);
    },
  });
}

export function useUpdateStockItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<StockItem> }) =>
      db.stockItems.update(id, updates),
    onSuccess: () => {
      invalidateStock(queryClient);
    },
  });
}

export function useDeleteStockItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.stockItems.delete(id),
    onSuccess: () => {
      invalidateStock(queryClient);
    },
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
    }) =>
      apiRoutes.stock.adjust(id, {
        movement_type: data.type,
        quantity_change: data.quantity,
        reason: data.reason || '',
        performed_by: data.performedBy || '',
      }),
    onSuccess: () => {
      invalidateStock(queryClient, true);
    },
  });
}

export function useStockMovements(stockItemId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_MOVEMENTS, stockItemId],
    queryFn: () => db.stockItems.getMovements(stockItemId),
    enabled: !!stockItemId,
  });
}

export function useLowStockCount() {
  return useQuery({
    queryKey: [QUERY_KEYS.LOW_STOCK_COUNT],
    queryFn: () => db.stockItems.getLowStockCount(),
  });
}
