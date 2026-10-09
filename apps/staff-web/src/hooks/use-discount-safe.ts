/**
 * Type-Safe Discount Hooks
 */

import { validateOrThrow } from '@gustri/core';
import { DiscountApplyInputSchema } from '@gustri/database/schemas/inputs';
import { getOrCreateClientRequestId, QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';

type ApplyDiscountInput = {
  orderId: string;
  discount_type: 'none' | 'percentage' | 'fixed';
  discount_value: number;
  discount_reason?: string | null;
  discount_applied_by: string;
  client_request_id?: string;
};

export function useApplyDiscount() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    // `retry: 0` — discounts write to financial_audit_log; an automatic
    // retry would risk duplicate audit rows. User-driven retries reuse
    // the same client_request_id (stamped below) so the server dedupes
    // via the partial unique index from migration 20260504000002.
    retry: 0,
    onMutate: (params: ApplyDiscountInput) => {
      params.client_request_id = getOrCreateClientRequestId(params.client_request_id);
    },
    mutationFn: (params: ApplyDiscountInput) => {
      // Invariant: `onMutate` above stamps `client_request_id`. If it's
      // missing here, re-minting silently would bypass the server's dedupe
      // path and risk duplicate financial_audit_log rows.
      if (!params.client_request_id) {
        throw new Error('applyDiscount: client_request_id missing — onMutate must run first');
      }
      // M5 — validate at the UI→hook boundary: reject negative/NaN values
      // and percentage discounts > 100 before they reach the server.
      const discount = validateOrThrow(DiscountApplyInputSchema, params, 'Invalid discount');
      return apiRoutes.discounts.apply(discount.orderId, {
        discount_type: discount.discount_type,
        discount_value: discount.discount_value,
        discount_reason: discount.discount_reason,
        discount_applied_by: discount.discount_applied_by,
        client_request_id: discount.client_request_id,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS) });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.ORDER, variables.orderId),
      });
      // A discount changes the order total, so the remaining balance changes.
      // The real balance key is [PAYMENTS, tenant, orderId, 'balance'] — the old
      // [PAYMENTS, tenant, 'remaining_balance', orderId] matched nothing, so the
      // payment modal kept showing a pre-discount balance.
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.PAYMENTS, variables.orderId, 'balance'),
      });
    },
  });
}
