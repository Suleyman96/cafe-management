/**
 * Type-Safe Stock Hooks
 */

import { QUERY_KEYS } from '@cafe-idare/core';
import type { Database } from '@cafe-idare/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

type StockItem = Database['public']['Tables']['stock_items']['Row'];
type StockItemInsert = Database['public']['Tables']['stock_items']['Insert'];

export function useStockItems(options?: { category?: string; lowStockOnly?: boolean }) {
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_ITEMS, options],
    queryFn: () => db.stockItems.findAll(options),
  });
}

export function useStockItem(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.STOCK_ITEM, id],
    queryFn: () => db.stockItems.findById(id),
    enabled: !!id,
  });
}

export function useCreateStockItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StockItemInsert) => db.stockItems.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STOCK_ITEMS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LOW_STOCK_COUNT] });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.STOCK_ITEMS] });
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.LOW_STOCK_COUNT] });
    },
  });
}

export function useUpdateStockItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<StockItem> }) =>
      db.stockItems.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STOCK_ITEMS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LOW_STOCK_COUNT] });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.STOCK_ITEMS] });
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.LOW_STOCK_COUNT] });
    },
  });
}

export function useDeleteStockItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.stockItems.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STOCK_ITEMS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LOW_STOCK_COUNT] });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.STOCK_ITEMS] });
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.LOW_STOCK_COUNT] });
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
    }) => db.stockItems.adjustStock(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STOCK_ITEMS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STOCK_MOVEMENTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LOW_STOCK_COUNT] });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.STOCK_ITEMS] });
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.STOCK_MOVEMENTS] });
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.LOW_STOCK_COUNT] });
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
