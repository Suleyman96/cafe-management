import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { Table } from '@/types';

export function useTables() {
  return useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      const data = await db.tables.findAll();
      return data as Table[];
    },
  });
}

export function useTable(tableId: string) {
  return useQuery({
    queryKey: ['table', tableId],
    queryFn: async () => {
      const data = await db.tables.findById(tableId);
      return data as Table;
    },
  });
}

export function useUpdateTableStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tableId, status }: { tableId: string; status: string }) => {
      const data = await db.tables.updateStatus(tableId, status as any);
      return data as Table;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}
