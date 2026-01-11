import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '../supabase';
import type { Table, TableStatus } from '../../types';

export function useTables() {
  return useQuery<Table[], Error>({
    queryKey: ['tables'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('tables')
        .select('*')
        .order('table_number', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });
}

export function useTable(tableId: string) {
  return useQuery<Table, Error>({
    queryKey: ['tables', tableId],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('tables')
        .select('*')
        .eq('id', tableId)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateTableStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ tableId, status }: { tableId: string; status: TableStatus }) => {
      const { data, error } = await getSupabaseClient()
        .from('tables')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', tableId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}