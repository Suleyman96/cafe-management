/**
 * Type-Safe Refund Hooks
 */

import { validateOrThrow } from '@gustri/core';
import { RefundCreateInputSchema } from '@gustri/database/schemas/inputs';
import { getOrCreateClientRequestId, QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';
import { db } from '@/lib/supabase/wrapped-client';

export function useOrderRefunds(orderId: string) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.PAYMENTS, 'refunds', orderId),
    queryFn: () => db.refunds.findByOrderId(orderId),
    enabled: !!orderId,
  });
}

type CreateRefundInput = {
  order_id: string;
  processed_by: string;
  amount: number;
  reason: string;
  refund_method: 'cash' | 'card' | 'digital';
  order_item_ids?: string[] | null;
  notes?: string | null;
  client_request_id?: string;
};

export function useCreateRefund() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    // `retry: 0` — refunds must not auto-retry on a network blip; the
    // server dedupes a user-driven retry via the (tenant_id,
    // client_request_id) partial unique index.
    retry: 0,
    onMutate: (params: CreateRefundInput) => {
      params.client_request_id = getOrCreateClientRequestId(params.client_request_id);
    },
    mutationFn: (params: CreateRefundInput) => {
      // Invariant: `onMutate` above stamps `client_request_id`. If it's
      // missing here, re-minting silently would bypass the server's dedupe
      // path and risk a double refund on a network retry.
      if (!params.client_request_id) {
        throw new Error('createRefund: client_request_id missing — onMutate must run first');
      }
      // M5 — validate at the UI→hook boundary: reject negative/zero/NaN
      // amounts and over-long reasons before they reach the server.
      const refund = validateOrThrow(RefundCreateInputSchema, params, 'Invalid refund');
      return apiRoutes.refunds.create(refund.order_id, {
        amount: refund.amount,
        reason: refund.reason,
        refund_method: refund.refund_method,
        processed_by: refund.processed_by,
        order_item_ids: refund.order_item_ids,
        notes: refund.notes,
        client_request_id: refund.client_request_id,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS) });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.ORDER, variables.order_id),
      });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.PAYMENTS, variables.order_id),
      });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.PAYMENTS, 'refunds', variables.order_id),
      });
      // Real balance key is [PAYMENTS, tenant, orderId, 'balance']; the old
      // 'remaining_balance' variant matched nothing. (The PAYMENTS-prefix
      // invalidation above already covers it, but keep this explicit + correct.)
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.PAYMENTS, variables.order_id, 'balance'),
      });
    },
  });
}
