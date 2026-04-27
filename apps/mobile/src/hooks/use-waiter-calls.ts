import { QUERY_KEYS } from '@gustri/core';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { MUTATION_KEYS } from '@/lib/mutation-keys';
import { notifyWaiterCall } from '@/lib/notifications';
import { playWaiterCallSound } from '@/lib/sound';
import { db } from '@/lib/supabase';
import { useRealtimeStatusStore } from '@/store/realtime-status-store';
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

  // Fallback alert path — see use-orders.ts for the rationale.
  // When realtime is degraded the INSERT side effect never fires, so diff
  // the previous and current call IDs and play a sound for new arrivals.
  const knownCallIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!query.data) return;
    const fresh = new Set(query.data.map((c) => c.id));
    if (knownCallIdsRef.current === null) {
      knownCallIdsRef.current = fresh;
      return;
    }
    const previous = knownCallIdsRef.current;
    knownCallIdsRef.current = fresh;

    const isDegraded = useRealtimeStatusStore.getState().isAnyDegraded();
    if (!isDegraded) return;

    const newCalls = query.data.filter((c) => !previous.has(c.id));
    if (newCalls.length === 0) return;

    void playWaiterCallSound();
    for (const call of newCalls) {
      if (!call.table_id) continue;
      void db.tables
        .findById(call.table_id)
        .then((table) =>
          notifyWaiterCall(
            (table as { table_number: string }).table_number,
            call.call_type ?? 'assistance',
            call.table_id ?? undefined,
          ),
        )
        .catch(() => {
          // Table lookup failed — sound already played, banner still visible
        });
    }
  }, [query.data]);

  return query;
}

// Local composite mutation — kept for backward compatibility with existing consumers
export function useUpdateWaiterCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: MUTATION_KEYS.UPDATE_WAITER_CALL,
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
