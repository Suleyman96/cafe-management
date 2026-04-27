import { QUERY_KEYS } from '@gustri/core';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { notifyWaiterCall } from '@/lib/notifications';
import { playWaiterCallSound } from '@/lib/sound';
import { db } from '@/lib/supabase';
import type { WaiterCall } from '@/types';
import { useRealtimeSync } from './use-realtime-sync';

// Shared mutations re-exported for direct use
export { useAcknowledgeWaiterCall, useResolveWaiterCall } from '@gustri/queries';

// Local hook — has realtime subscription with sound/notification side effects
export function useWaiterCalls(status?: WaiterCall['status']) {
  const query = useQuery({
    queryKey: [QUERY_KEYS.WAITER_CALLS, status],
    queryFn: async (): Promise<WaiterCall[]> => {
      return await db.waiterCalls.findAll(status ? { status } : undefined);
    },
  });

  const realtimeHandlers = useMemo(
    () => [
      {
        table: 'waiter_calls' as const,
        event: 'INSERT' as const,
        queryKeys: [[QUERY_KEYS.WAITER_CALLS]],
        onPayload: async (newRecord: Record<string, unknown>) => {
          await playWaiterCallSound();

          try {
            const tableData = (await db.tables.findById(newRecord.table_id as string)) as {
              table_number: string;
            };
            await notifyWaiterCall(
              tableData.table_number,
              (newRecord.call_type as string) ?? 'assistance',
              newRecord.table_id as string,
            );
          } catch {
            // Table lookup failed — notification skipped, invalidation still happens
          }
        },
      },
      {
        table: 'waiter_calls' as const,
        event: 'UPDATE' as const,
        queryKeys: [[QUERY_KEYS.WAITER_CALLS]],
      },
    ],
    [],
  );

  useRealtimeSync('waiter_calls', realtimeHandlers);

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
      Sentry.captureException(error, { extra: { context: 'updateWaiterCall' } });
    },
  });
}
