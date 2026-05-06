/**
 * Type-Safe Waiter Calls Hooks
 * Re-exports from @gustri/queries, with local composite hooks and helpers.
 *
 * staff-web composite mutations differ from `@gustri/queries`:
 *  - `{ callId }` arg shape (the calls page already uses `call.id` as
 *    `callId`; renaming would churn the UI for no benefit).
 *  - Localized "already answered by X" toast on ConflictError, since the
 *    second waiter to tap "Answer" is the user the message is for.
 */

import { ConflictError } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import {
  getOrCreateClientRequestId,
  invalidateWaiterCalls,
  QUERY_KEYS,
  tenantKey,
  useDb,
  useTenantId,
  useWaiterCalls as useWaiterCallsShared,
} from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// `t` shape from react-i18next; aliased so the helper signature reads as
// "translator" rather than the long inline type.
type Translator = ReturnType<typeof useTranslation>['t'];

// Re-export shared read hooks
export { usePendingWaiterCallsCount, useWaiterCalls } from '@gustri/queries';

const ACK_CONFLICT = 'waiter_call_already_acknowledged';
const RESOLVE_CONFLICT = 'waiter_call_already_resolved';

function isConflictWith(error: unknown, sentinel: string): boolean {
  return error instanceof ConflictError && error.message === sentinel;
}

/**
 * Refetch the conflicting call so we can name the staff member who won
 * the race. Falls back to a generic toast when the row or staff name is
 * unavailable (RLS hide, deleted, etc.).
 */
async function showAlreadyAnsweredToast(
  t: Translator,
  db: ReturnType<typeof useDb>,
  callId: string,
  fallbackKey: string,
) {
  try {
    const calls = await db.waiterCalls.findAll();
    const row = calls.find((c) => c.id === callId);
    if (!row?.responded_by) {
      toast.error(t(fallbackKey));
      return;
    }
    const staff = await db.staff.findById(row.responded_by);
    const name = staff?.full_name?.trim() || t('calls.alreadyAnsweredFallbackName');
    toast.error(t('calls.alreadyAnsweredBy', { name }));
  } catch {
    toast.error(t(fallbackKey));
  }
}

type AcknowledgeVars = { callId: string; staffId: string; clientRequestId?: string };
type ResolveVars = { callId: string; notes?: string; clientRequestId?: string };

export function useAcknowledgeWaiterCall() {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const { t } = useTranslation('staff');
  return useMutation({
    onMutate: (vars: AcknowledgeVars) => {
      vars.clientRequestId = getOrCreateClientRequestId(vars.clientRequestId);
    },
    mutationFn: ({ callId, staffId, clientRequestId }: AcknowledgeVars) =>
      db.waiterCalls.acknowledge(callId, staffId, { clientRequestId }),
    retry: 0,
    onSuccess: () => {
      invalidateWaiterCalls(queryClient, tenantId);
    },
    onError: async (error, vars) => {
      if (isConflictWith(error, ACK_CONFLICT)) {
        // Pull the latest state so the leaderboard reflects whoever won;
        // the toast names them.
        await queryClient.invalidateQueries({
          queryKey: tenantKey(tenantId, QUERY_KEYS.WAITER_CALLS),
        });
        await showAlreadyAnsweredToast(t, db, vars.callId, 'calls.failedAcknowledge');
      }
    },
  });
}

export function useResolveWaiterCall() {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const { t } = useTranslation('staff');
  return useMutation({
    onMutate: (vars: ResolveVars) => {
      vars.clientRequestId = getOrCreateClientRequestId(vars.clientRequestId);
    },
    mutationFn: ({ callId, notes, clientRequestId }: ResolveVars) =>
      db.waiterCalls.resolve(callId, { notes, clientRequestId }),
    retry: 0,
    onSuccess: () => {
      invalidateWaiterCalls(queryClient, tenantId);
    },
    onError: async (error, vars) => {
      if (isConflictWith(error, RESOLVE_CONFLICT)) {
        await queryClient.invalidateQueries({
          queryKey: tenantKey(tenantId, QUERY_KEYS.WAITER_CALLS),
        });
        await showAlreadyAnsweredToast(t, db, vars.callId, 'calls.failedResolve');
      }
    },
  });
}

// Composite hook: filters active calls for a specific table (app-specific)
export function useActiveCallsForTable(tableId: string) {
  const { data: allCalls, ...rest } = useWaiterCallsShared('pending');

  const tableCalls = allCalls?.filter((call) => call.table_id === tableId) || [];

  return {
    ...rest,
    data: tableCalls,
  };
}
