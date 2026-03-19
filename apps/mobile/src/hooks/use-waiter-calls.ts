import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { notifyWaiterCall } from '@/lib/notifications';
import { playWaiterCallSound } from '@/lib/sound';
import { db, supabase } from '@/lib/supabase';
import type { WaiterCallWithTable } from '@/types';

export function useWaiterCalls(status: string = 'pending') {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['waiter_calls', status],
    queryFn: async () => {
      const data = await db.waiterCalls.findAll(status as any);
      return data as WaiterCallWithTable[];
    },
  });

  // Real-time subscription (needs raw supabase client for channel API)
  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      channel = supabase
        .channel('waiter_calls')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'waiter_calls',
          },
          async (payload) => {
            await playWaiterCallSound();

            const { data: tableData } = await supabase
              .from('tables')
              .select('table_number')
              .eq('id', (payload.new as any).table_id)
              .single();

            if (tableData) {
              await notifyWaiterCall((tableData as any).table_number, (payload.new as any).reason);
            }

            queryClient.invalidateQueries({ queryKey: ['waiter_calls'] });
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'waiter_calls',
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['waiter_calls'] });
          },
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [queryClient]);

  return query;
}

export function useUpdateWaiterCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      callId,
      status,
      staffId,
    }: {
      callId: string;
      status: string;
      staffId?: string;
    }) => {
      if (status === 'acknowledged' && staffId) {
        return await db.waiterCalls.acknowledge(callId, staffId);
      }
      if (status === 'resolved') {
        return await db.waiterCalls.resolve(callId);
      }
      // Fallback for other statuses
      return await db.waiterCalls.acknowledge(callId, staffId || '');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiter_calls'] });
    },
  });
}
