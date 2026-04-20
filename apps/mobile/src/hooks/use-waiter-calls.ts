import { QUERY_KEYS } from '@gustri/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { notifyWaiterCall } from '@/lib/notifications';
import { playWaiterCallSound } from '@/lib/sound';
import { db, supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import type { WaiterCall } from '@/types';

// Shared mutations re-exported for direct use
export { useAcknowledgeWaiterCall, useResolveWaiterCall } from '@gustri/queries';

// Local hook — has realtime subscription with sound/notification side effects
export function useWaiterCalls(status?: WaiterCall['status']) {
  const queryClient = useQueryClient();
  const tenantId = useAuthStore((s) => s.staff?.tenant_id);

  const query = useQuery({
    queryKey: [QUERY_KEYS.WAITER_CALLS, status],
    queryFn: async (): Promise<WaiterCall[]> => {
      return await db.waiterCalls.findAll(status);
    },
  });

  // Real-time subscription (needs raw supabase client for channel API)
  useEffect(() => {
    if (!tenantId) return;
    let channel: RealtimeChannel;

    const tenantFilter = `tenant_id=eq.${tenantId}`;

    const setupSubscription = async () => {
      channel = supabase
        .channel('waiter_calls')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'waiter_calls',
            filter: tenantFilter,
          },
          async (payload) => {
            await playWaiterCallSound();

            const newRecord = payload.new as Record<string, unknown>;
            const { data } = await supabase
              .from('tables')
              .select('table_number')
              .eq('id', newRecord.table_id as string)
              .single();

            const tableData = data as { table_number: string } | null;

            if (tableData) {
              await notifyWaiterCall(
                tableData.table_number,
                (newRecord.call_type as string) ?? 'assistance',
              );
            }

            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.WAITER_CALLS] });
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'waiter_calls',
            filter: tenantFilter,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.WAITER_CALLS] });
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
  }, [queryClient, tenantId]);

  return query;
}

// Local composite mutation — kept for backward compatibility with existing consumers
export function useUpdateWaiterCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['update-waiter-call'],
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
      throw new Error(`Unsupported waiter call status: ${status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.WAITER_CALLS] });
    },
    onError: (error: Error) => {
      console.error('Failed to update waiter call:', error.message);
    },
  });
}
