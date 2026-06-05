import type { WaiterCall } from '@gustri/database/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrCreateClientRequestId } from '../idempotency';
import { invalidateWaiterCalls } from '../invalidation';
import { QUERY_KEYS, tenantKey } from '../keys';
import { type OptimisticSnapshot, patchQueries, rollbackQueries } from '../optimistic';
import { useDb, useTenantId } from '../provider';
import type { MutationCallbacks } from './types';

type AcknowledgeVars = { id: string; staffId: string; clientRequestId?: string };
type ResolveVars = { id: string; notes?: string; clientRequestId?: string };

export function useAcknowledgeWaiterCall(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    // Stamp `client_request_id` onto variables so a paused-then-replayed
    // mutation hits the migration 20260506000001 dedupe path. Web gains
    // in-flight retry safety; mobile gets full offline-replay safety via
    // the persister. Then optimistically flip the call to acknowledged
    // (mirrors the wrapper's payload: status/responded_by/acknowledged_at)
    // so the calls list reacts instantly. The snapshot rolls back on error.
    onMutate: async (vars: AcknowledgeVars) => {
      vars.clientRequestId = getOrCreateClientRequestId(vars.clientRequestId);
      const snapshot: OptimisticSnapshot = await patchQueries<WaiterCall[]>(
        queryClient,
        tenantKey(tenantId, QUERY_KEYS.WAITER_CALLS),
        (list) =>
          Array.isArray(list)
            ? list.map((c) =>
                c.id === vars.id
                  ? {
                      ...c,
                      status: 'acknowledged' as WaiterCall['status'],
                      responded_by: vars.staffId,
                      acknowledged_at: new Date().toISOString(),
                    }
                  : c,
              )
            : list,
      );
      return { snapshot };
    },
    mutationFn: ({ id, staffId, clientRequestId }: AcknowledgeVars) =>
      db.waiterCalls.acknowledge(id, staffId, { clientRequestId }),
    // Auto-retry on a contended waiter-call would race a second staff
    // member's acknowledge; let the caller decide explicitly.
    retry: 0,
    onError: (err, _vars, context) => {
      if (context?.snapshot) rollbackQueries(queryClient, context.snapshot);
      options?.onError?.(err);
    },
    onSettled: () => {
      invalidateWaiterCalls(queryClient, tenantId);
    },
  });
}

export function useResolveWaiterCall(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    onMutate: (vars: ResolveVars) => {
      vars.clientRequestId = getOrCreateClientRequestId(vars.clientRequestId);
    },
    mutationFn: ({ id, notes, clientRequestId }: ResolveVars) =>
      db.waiterCalls.resolve(id, { notes, clientRequestId }),
    retry: 0,
    onSuccess: () => {
      invalidateWaiterCalls(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}
