/**
 * Table Transfer Hooks
 * Used by: staff-web, mobile-app
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '../supabase';
import type { TableTransfer, TableTransferWithDetails } from '../../types';

// ========================================
// Query: Get transfer history for an order
// ========================================

export function useOrderTransferHistory(orderId: string) {
  return useQuery({
    queryKey: ['table_transfers', orderId],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('table_transfers')
        .select(`
          *,
          from_table:tables!from_table_id(table_number, location),
          to_table:tables!to_table_id(table_number, location),
          transferred_by_staff:staff!transferred_by(full_name, role)
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TableTransferWithDetails[];
    },
    enabled: !!orderId,
  });
}

// ========================================
// Query: Get recent transfers (for analytics)
// ========================================

export function useRecentTransfers(limit: number = 50) {
  return useQuery({
    queryKey: ['table_transfers', 'recent', limit],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('table_transfers')
        .select(`
          *,
          from_table:tables!from_table_id(table_number, location),
          to_table:tables!to_table_id(table_number, location),
          transferred_by_staff:staff!transferred_by(full_name, role),
          order:orders(order_number, status)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
  });
}

// ========================================
// Query: Get transfer count for today
// ========================================

export function useTodayTransferCount() {
  return useQuery({
    queryKey: ['table_transfers', 'today', 'count'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count, error } = await getSupabaseClient()
        .from('table_transfers')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      if (error) throw error;
      return count || 0;
    },
  });
}

// ========================================
// Mutation: Transfer table
// ========================================

interface TransferTableData {
  orderId: string;
  fromTableId: string;
  toTableId: string;
  staffId: string;
  reason?: string;
}

export function useTransferTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: TransferTableData) => {
      const { data, error } = await getSupabaseClient().rpc('transfer_table', {
        p_order_id: params.orderId,
        p_from_table_id: params.fromTableId,
        p_to_table_id: params.toTableId,
        p_staff_id: params.staffId,
        p_reason: params.reason || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate table queries
      queryClient.invalidateQueries({ 
        queryKey: ['tables'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['table', variables.fromTableId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['table', variables.toTableId] 
      });
      
      // Invalidate order queries
      queryClient.invalidateQueries({ 
        queryKey: ['orders', variables.orderId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['order', variables.orderId] 
      });
      
      // Invalidate transfer history
      queryClient.invalidateQueries({ 
        queryKey: ['table_transfers'] 
      });
      
      // Invalidate order lists
      queryClient.invalidateQueries({ 
        queryKey: ['orders'] 
      });
    },
  });
}

// ========================================
// Helper: Validate table transfer
// ========================================

export function canTransferTable(
  orderStatus: string,
  targetTableStatus: string
): { canTransfer: boolean; reason?: string } {
  // Can't transfer closed or cancelled orders
  if (orderStatus === 'closed' || orderStatus === 'cancelled') {
    return {
      canTransfer: false,
      reason: 'Cannot transfer closed or cancelled orders',
    };
  }

  // Target table must be free or reserved
  if (targetTableStatus !== 'free' && targetTableStatus !== 'reserved') {
    return {
      canTransfer: false,
      reason: 'Target table is not available',
    };
  }

  return { canTransfer: true };
}

