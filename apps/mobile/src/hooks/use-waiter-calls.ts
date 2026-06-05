import { WaiterCallsRealtimeInsertSchema, WaiterCallsRealtimeUpdateSchema } from '@gustri/database';
import type { Table } from '@gustri/database/types';
import { patchQueries, QUERY_KEYS, rollbackQueries } from '@gustri/queries';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { markEvent, RECONNECT_REPLAY_WINDOW_MS, seenRecently } from '@/lib/event-dedup';
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
          const parsed = WaiterCallsRealtimeInsertSchema.safeParse(newRecord);
          if (parsed.success) {
            const callKey = `waiter_call:${parsed.data.table_id}`;
            // Audit #5 + C2 — Supabase Realtime can re-deliver an INSERT
            // after a disconnect; backgrounded devices commonly miss
            // traffic for several minutes. The RECONNECT_REPLAY_WINDOW_MS
            // lookup catches that backlog so the same table's assistance
            // call doesn't ring twice. Keyed on table_id (not call id) to
            // match the push handler's payload shape — same reason as the
            // realtime↔push race dedup below.
            const isReplay = seenRecently(callKey, RECONNECT_REPLAY_WINDOW_MS);
            // Mark by table_id so the push handler — whose payload carries
            // tableId, not callId — can match. Mark BEFORE playing so a
            // near-simultaneous push suppresses its own sound via seenRecently.
            markEvent(callKey);
            if (isReplay) {
              // Replay path skips side effects but still invalidates via the
              // realtime handler chain — `useRealtimeSync` runs the
              // `queryKeys` invalidation regardless of `onPayload`'s return.
              return;
            }
          }

          hapticEvent();
          await playWaiterCallSound();

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

    // Widened gate so reconnecting state also alerts; dedup against the
    // realtime path so a brief recovery delivering the same INSERT doesn't double-play.
    const isUnhealthy = useRealtimeStatusStore.getState().isAnyUnhealthy();
    if (!isUnhealthy) return;

    const newCalls = query.data
      .filter((c) => !previous.has(c.id))
      .filter((c) => !(c.table_id && seenRecently(`waiter_call:${c.table_id}`)));
    if (newCalls.length === 0) return;

    for (const call of newCalls) {
      if (call.table_id) markEvent(`waiter_call:${call.table_id}`);
    }

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
    // Optimistic: flip the call's status (and the acknowledge/resolve
    // timestamps the wrapper sets) so the calls list reacts instantly.
    onMutate: async ({ callId, status, staffId }) => {
      const snapshot = await patchQueries<WaiterCall[]>(
        queryClient,
        [QUERY_KEYS.WAITER_CALLS],
        (list) =>
          Array.isArray(list)
            ? list.map((c) =>
                c.id === callId
                  ? {
                      ...c,
                      status: status as WaiterCall['status'],
                      ...(status === 'acknowledged'
                        ? {
                            responded_by: staffId ?? c.responded_by,
                            acknowledged_at: new Date().toISOString(),
                          }
                        : {}),
                      ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
                    }
                  : c,
              )
            : list,
      );
      return { snapshot };
    },
    onSuccess: (_data, variables) => {
      if (variables.status === 'acknowledged') hapticSuccess();
    },
    onError: (error: Error, _vars, context) => {
      if (context?.snapshot) rollbackQueries(queryClient, context.snapshot);
      Sentry.captureException(error, { extra: { context: 'updateWaiterCall' } });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.WAITER_CALLS] });
    },
  });
}
