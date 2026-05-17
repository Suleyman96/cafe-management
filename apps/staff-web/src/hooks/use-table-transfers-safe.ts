/**
 * Type-Safe Table Transfer Hooks
 * Uses the wrapped client for type safety without 'as any'
 *
 * Note: `useTransferTable` was promoted to `@gustri/queries` in Phase 1.5
 * (mobile parity) — both apps now import it from there. The other hooks
 * here either depend on the web `db` directly (transfer history view) or
 * are web-only flows (item-level transfer).
 */

import type { OrderWithItems } from '@gustri/database';
import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

export function useOrderTransferHistory(orderId: string) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, 'table_transfers', orderId),
    queryFn: async () => {
      // Get order details which includes transfer history
      const order = (await db.orders.findById(orderId)) as OrderWithItems;
      return order.table_transfers || [];
    },
    enabled: !!orderId,
  });
}

export function useTransferOrderItems() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: (params: {
      sourceOrderId: string;
      destinationTableId: string;
      items: Array<{ item_id: string; quantity: number }>;
      staffId: string;
      reason?: string;
    }) => db.rpc.transferOrderItems(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TABLES) });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS) });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDER) });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS) });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'table_transfers') });
    },
  });
}

// Maps transfer reason codes to i18n keys
const TRANSFER_REASON_KEYS: Record<string, string> = {
  customer_request: 'tables.transferReasonCustomerRequest',
  table_combine: 'tables.transferReasonTableCombine',
  table_split: 'tables.transferReasonTableSplit',
  operational: 'tables.transferReasonOperational',
  maintenance: 'tables.transferReasonMaintenance',
};

// Returns i18n key for known reasons, or the raw string for custom reasons
export function getTransferReasonKey(reason?: string | null): string {
  if (!reason) return 'tables.transferReasonNoReason';
  return TRANSFER_REASON_KEYS[reason] || reason;
}
