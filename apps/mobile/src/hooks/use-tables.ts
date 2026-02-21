import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Table } from '@/types';

export function useTables() {
  return useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('is_active', true)
        .order('table_number', { ascending: true });

      if (error) throw error;
      return data as Table[];
    },
  });
}

export function useTable(tableId: string) {
  return useQuery({
    queryKey: ['table', tableId],
    queryFn: async () => {
      const { data, error } = await supabase.from('tables').select('*').eq('id', tableId).single();

      if (error) throw error;
      return data as Table;
    },
  });
}

export function useUpdateTableStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tableId, status }: { tableId: string; status: string }) => {
      const { data, error } = await supabase
        .from('tables')
        .update({ status })
        .eq('id', tableId)
        .select()
        .single();

      if (error) throw error;
      return data as Table;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}
