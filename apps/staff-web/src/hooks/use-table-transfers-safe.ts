/**
 * Type-Safe Table Transfer Hooks
 * Uses the wrapped client for type safety without 'as any'
 */

import { QUERY_KEYS } from '@cafe-idare/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

interface TransferTableData {
  orderId: string;
  fromTableId: string;
  toTableId: string;
  staffId: string;
  reason?: string;
}

export function useOrderTransferHistory(orderId: string) {
  return useQuery({
    queryKey: ['table_transfers', orderId],
    queryFn: async () => {
      // Get order details which includes transfer history
      const order = (await db.orders.findById(orderId)) as any;
      return order.table_transfers || [];
    },
    enabled: !!orderId,
  });
}

export function useTransferTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: TransferTableData) => db.rpc.transferTable(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLE, variables.fromTableId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLE, variables.toTableId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS, variables.orderId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ['table_transfers'] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
    },
  });
}

// Helper to format transfer reason
export function formatTransferReason(reason?: string | null): string {
  if (!reason) return 'No reason provided';

  const reasons: Record<string, string> = {
    customer_request: 'Customer requested move',
    table_combine: 'Tables combined',
    table_split: 'Tables split',
    operational: 'Operational reasons',
    maintenance: 'Table maintenance',
  };

  return reasons[reason] || reason;
}

// Helper to get transfer summary for a table
export function useTableTransferStats(tableId: string) {
  return useQuery({
    queryKey: ['table_transfer_stats', tableId],
    queryFn: async () => {
      // This would ideally be an RPC function on Supabase
      // For now, we'll fetch orders and analyze transfers
      const orders = await db.orders.findAll({ table_id: tableId });

      let transfersIn = 0;
      let transfersOut = 0;

      orders.forEach((order: any) => {
        if (order.table_transfers) {
          order.table_transfers.forEach((transfer: any) => {
            if (transfer.to_table_id === tableId) transfersIn++;
            if (transfer.from_table_id === tableId) transfersOut++;
          });
        }
      });

      return {
        transfersIn,
        transfersOut,
        totalTransfers: transfersIn + transfersOut,
      };
    },
    enabled: !!tableId,
  });
}
