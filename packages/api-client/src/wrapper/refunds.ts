/**
 * Refunds wrapper module
 */

import { handleSupabaseError } from '@gustri/core';
import type { WrapperContext } from './types';

export function createRefundsWrapper(ctx: WrapperContext) {
  return {
    create: async (refundData: {
      order_id: string;
      processed_by: string;
      amount: number;
      reason: string;
      refund_method: 'cash' | 'card' | 'digital';
      order_item_ids?: string[] | null;
      notes?: string | null;
    }) => {
      const { data, error } = await ctx.anyClient
        .from('refunds')
        .insert(refundData)
        .select(`
          *,
          processed_by_staff:staff!refunds_processed_by_fkey(full_name, role)
        `)
        .single();

      if (error) throw handleSupabaseError(error);
      return data;
    },

    findByOrderId: async (orderId: string) => {
      const { data, error } = await ctx.client
        .from('refunds')
        .select(`
          *,
          processed_by_staff:staff!refunds_processed_by_fkey(full_name, role)
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findByDateRange: async (startDate: string, endDate: string) => {
      const { data, error } = await ctx.client
        .from('refunds')
        .select(`
          *,
          processed_by_staff:staff!refunds_processed_by_fkey(full_name, role)
        `)
        .gte('created_at', startDate)
        .lt('created_at', endDate)
        .order('created_at', { ascending: false });

      if (error) throw handleSupabaseError(error);
      return data || [];
    },
  };
}

export type RefundsWrapper = ReturnType<typeof createRefundsWrapper>;
