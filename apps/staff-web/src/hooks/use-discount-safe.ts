/**
 * Type-Safe Discount Hooks
 */

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
    mutationFn: (params: ApplyDiscountInput) =>
      apiRoutes.discounts.apply(params.orderId, {
        discount_type: params.discount_type,
        discount_value: params.discount_value,
        discount_reason: params.discount_reason,
        discount_applied_by: params.discount_applied_by,
        client_request_id: params.client_request_id as string,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS) });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.ORDER, variables.orderId),
      });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.PAYMENTS, 'remaining_balance', variables.orderId),
      });
    },
  });
}
