import { QUERY_KEYS } from '@gustri/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { Table } from '@/types';

export function useTables() {
  return useQuery({
    queryKey: [QUERY_KEYS.TABLES],
    queryFn: async (): Promise<Table[]> => {
      return await db.tables.findAll();
    },
  });
}

export function useTable(tableId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.TABLE, tableId],
    queryFn: async (): Promise<Table> => {
      return await db.tables.findById(tableId);
    },
  });
}

export function useUpdateTableStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tableId, status }: { tableId: string; status: Table['status'] }) => {
      return await db.tables.updateStatus(tableId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
    onError: (error: Error) => {
      console.error('Failed to update table status:', error.message);
    },
  });
}
