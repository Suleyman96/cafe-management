import { getOrCreateClientRequestId, QUERY_KEYS } from '@gustri/queries';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { apiRoutes } from '@/lib/api-routes';
import { db, supabase } from '@/lib/supabase';
import { useWaiterCallIdempotency } from '@/store/waiter-call-store';
import type { WaiterCall } from '@/types';

type CallType = 'assistance' | 'bill' | 'question' | 'complaint' | 'emergency';
type CallPriority = 'low' | 'normal' | 'high' | 'urgent';

interface CreateWaiterCallData {
  tableId: string;
  callType: CallType;
  reason: string;
  priority: CallPriority;
  notes?: string;
  // Stamped by `onMutate` from a shared Zustand slice
  // (`useWaiterCallIdempotency`) so the FAB and the in-order Call
  // Staff button share the same key across user-driven retries (C2).
  // The server dedupes on the `(tenant_id, client_request_id)`
  // partial unique index from migration 20260428000002.
  client_request_id?: string;
}

export function useCreateWaiterCall() {
  const queryClient = useQueryClient();
  const idempotency = useWaiterCallIdempotency();

  return useMutation({
    // `retry: 0` keeps a network blip from posting two pending calls.
    // The shared idempotency slice handles *user-driven* retries —
    // both call surfaces read from it so a double-tap that hits the
    // FAB first and the order-screen button second still reuses the
    // same id.
    retry: 0,
    onMutate: (vars: CreateWaiterCallData) => {
      vars.client_request_id = vars.client_request_id ?? idempotency.consume();
    },
    mutationFn: async ({
      tableId,
      callType,
      reason,
      priority,
      notes,
      client_request_id,
    }: CreateWaiterCallData): Promise<WaiterCall> => {
      const { waiter_call } = await apiRoutes.customerWaiterCalls.create({
        table_id: tableId,
        call_type: callType,
        reason: reason,
        priority: priority,
        notes: notes ?? null,
        client_request_id: getOrCreateClientRequestId(client_request_id),
      });
      return waiter_call as WaiterCall;
    },
    onSuccess: (_, variables) => {
      // Successful commit closes the current "pending call cycle";
      // the next call should get a fresh id rather than dedupe against
      // the prior one.
      idempotency.reset();
      // H6 — refresh the open-calls query so the FAB swaps to its
      // "Waiter notified" state immediately. The realtime echo would
      // also drive this within ~200 ms, but the local invalidate
      // closes the visible flicker.
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.WAITER_CALLS, variables.tableId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEYS.WAITER_CALLS, variables.tableId, 'open'],
      });
    },
  });
}

/**
 * H6 — open waiter-calls for a table, with realtime sync.
 *
 * Pre-H6 the FAB and the in-order Call Staff button had no visibility
 * into whether a call was already pending: the modal's 1.5 s success
 * flash closed and the idempotency store reset on success, so a retap
 * 30 s later (while waiter is en route through a noisy room) minted
 * a fresh id and inserted a second `waiter_calls` row. From the staff
 * queue this is two distinct calls, not a retry.
 *
 * The fix gates the CTA on a *server-side* fact ("is there an
 * unacknowledged call from this table right now?") rather than the
 * client's in-memory idempotency cycle. Realtime drives the FAB chip
 * the moment staff acknowledges (`status` flips from `pending`).
 *
 * Realtime filter scope. `table_id=eq.${tableId}` matches the lint
 * guard (`id=eq.` substring) and is anon-readable per the
 * `anon_read_waiter_calls_scoped` policy
 * (migration 20260418000001). UUID-keyed; presence-leak surface stays
 * closed.
 */
export function useOpenWaiterCallsForTable(tableId: string | undefined | null) {
  const queryClient = useQueryClient();

  const queryKey = [QUERY_KEYS.WAITER_CALLS, tableId ?? '', 'open'] as const;

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<WaiterCall[]> => {
      if (!tableId) return [];
      const rows = await db.waiterCalls.findByTable(tableId, 'pending');
      return rows as WaiterCall[];
    },
    // Disabled until we have a real tableId — same `||''` gate other
    // customer-web queries use so the loading state isn't pegged to
    // an empty key.
    enabled: !!tableId,
    staleTime: 10 * 1000,
  });

  // Realtime subscription on `waiter_calls` filtered by `table_id`.
  // Keeps the chip's "unlocked the moment staff acknowledges" promise
  // intact without polling. Mirrors the use-order channel lifecycle
  // (M5 useRef dedupe + deferred teardown + 150 ms invalidate
  // debounce) so a rapid mount/unmount cycle doesn't churn the
  // realtime server and so a status-change burst from staff (mark all
  // pending → acknowledged) collapses to one refetch.
  const channelRef = useRef<{ tableId: string; channel: RealtimeChannel } | null>(null);
  const teardownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invalidateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!tableId) return;

    if (teardownTimerRef.current !== null) {
      clearTimeout(teardownTimerRef.current);
      teardownTimerRef.current = null;
    }

    if (channelRef.current?.tableId === tableId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current.channel);
      channelRef.current = null;
    }

    const scheduleInvalidate = () => {
      if (invalidateDebounceRef.current) clearTimeout(invalidateDebounceRef.current);
      invalidateDebounceRef.current = setTimeout(() => {
        // Rebuild the key inline so the effect doesn't capture the
        // outer-scope alias (which gets a fresh reference each render
        // and would force a needless dep entry).
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEYS.WAITER_CALLS, tableId, 'open'],
        });
        invalidateDebounceRef.current = null;
      }, 150);
    };

    const channel: RealtimeChannel = supabase
      .channel(`waiter_calls:${tableId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waiter_calls',
          filter: `table_id=eq.${tableId}`,
        },
        () => {
          scheduleInvalidate();
        },
      )
      .subscribe();

    channelRef.current = { tableId, channel };

    return () => {
      teardownTimerRef.current = setTimeout(() => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current.channel);
          channelRef.current = null;
        }
        teardownTimerRef.current = null;
      }, 0);
      if (invalidateDebounceRef.current) {
        clearTimeout(invalidateDebounceRef.current);
        invalidateDebounceRef.current = null;
      }
    };
  }, [tableId, queryClient]);

  const openCall = query.data?.[0] ?? null;

  return {
    ...query,
    /** The most recent unacknowledged call from this table, or null. */
    openCall,
    /** Convenience: true when at least one open call exists. */
    hasOpenCall: !!openCall,
  };
}
