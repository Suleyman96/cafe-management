import type { Table } from '@gustri/database';
import { WaiterCallsRealtimeInsertSchema, WaiterCallsRealtimeUpdateSchema } from '@gustri/database';
import { QUERY_KEYS } from '@gustri/queries';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { hapticEvent, hapticSuccess } from '@/lib/haptics';
import { MUTATION_KEYS } from '@/lib/mutation-keys';
import { notifyWaiterCall } from '@/lib/notifications';
import { validateRealtimePayload } from '@/lib/realtime-validation';
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
          hapticEvent();
          await playWaiterCallSound();

          const parsed = WaiterCallsRealtimeInsertSchema.safeParse(newRecord);
          if (!parsed.success) {
            Sentry.captureException(parsed.error, {
              tags: { area: 'realtime.waiter_calls.insert' },
            });
            return;
          }
          const call = parsed.data;

          try {
            const tableData = (await db.tables.findById(call.table_id)) as Table | null;
            if (!tableData?.table_number) return;
            await notifyWaiterCall(
              tableData.table_number,
              call.call_type ?? 'assistance',
              call.table_id,
            );
          } catch (err: unknown) {
            Sentry.captureException(err, { tags: { area: 'realtime.waiter_calls.notify' } });
          }
        },
      },
      {
        table: 'waiter_calls' as const,
        event: 'UPDATE' as const,
        queryKeys: [[QUERY_KEYS.WAITER_CALLS]],
        onPayload: (newRecord: Record<string, unknown>) => {
          // Validate to surface schema drift via Sentry. Invalidation runs
          // unconditionally — even if validation fails we still want the cache
          // to refetch from the source of truth.
          validateRealtimePayload(WaiterCallsRealtimeUpdateSchema, newRecord, {
            table: 'waiter_calls',
            event: 'UPDATE',
          });
        },
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

    hapticEvent();
    void playWaiterCallSound();
    for (const call of newCalls) {
      if (!call.table_id) continue;
      void db.tables
        .findById(call.table_id)
        .then((table) => {
          const t = table as Table | null;
          if (!t?.table_number) return;
          return notifyWaiterCall(
            t.table_number,
            call.call_type ?? 'assistance',
            call.table_id ?? undefined,
          );
        })
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
    onSuccess: (_data, variables) => {
      if (variables.status === 'acknowledged') hapticSuccess();
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.WAITER_CALLS] });
    },
    onError: (error: Error) => {
      Sentry.captureException(error, { extra: { context: 'updateWaiterCall' } });
    },
  });
}
