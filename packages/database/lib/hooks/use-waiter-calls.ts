import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WaiterCall } from '../../types';
import { getSupabaseClient } from '../supabase';

type WaiterCallStatus = 'pending' | 'completed';

export function useWaiterCalls() {
  return useQuery<WaiterCall[], Error>({
    queryKey: ['waiter-calls'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('waiter_calls')
        .select(`
          *,
          table:tables(*),
          staff(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}

export function usePendingWaiterCalls() {
  return useQuery<WaiterCall[], Error>({
    queryKey: ['waiter-calls', 'pending'],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('waiter_calls')
        .select(`
          *,
          table:tables(*),
          staff(*)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}

export function useRespondToWaiterCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ callId, staffId }: { callId: string; staffId: string }) => {
      const { data, error } = await getSupabaseClient()
        .from('waiter_calls')
        .update({
          status: 'completed' as WaiterCallStatus,
          responded_by: staffId,
          responded_at: new Date().toISOString(),
        })
        .eq('id', callId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiter-calls'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}

export function useCreateWaiterCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (callData: Omit<WaiterCall, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await getSupabaseClient()
        .from('waiter_calls')
        .insert(callData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiter-calls'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}
