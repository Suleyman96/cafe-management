import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

export function useStockItems(options?: { category?: string; lowStockOnly?: boolean }) {
  return useQuery({
    queryKey: ['stock-items', options],
    queryFn: () => db.stockItems.findAll(options),
  });
}

export function useLowStockCount() {
  return useQuery({
    queryKey: ['stock-items', 'low-count'],
    queryFn: () => db.stockItems.getLowStockCount(),
  });
}

export function useStockTotalValue() {
  return useQuery({
    queryKey: ['stock-items', 'total-value'],
    queryFn: () => db.stockItems.getTotalValue(),
  });
}

export function useStockMovements(itemId: string | undefined) {
  return useQuery({
    queryKey: ['stock-movements', itemId],
    queryFn: () => db.stockItems.getMovements(itemId!),
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
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
    },
  });
}

export function useCreateStockItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => db.stockItems.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
    },
  });
}

export function useUpdateStockItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => db.stockItems.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
    },
  });
}

export function useDeleteStockItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.stockItems.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
    },
  });
}
