/**
 * Database views wrapper module
 */

import { handleSupabaseError } from '@cafe-idare/core';
import type { WrapperContext } from './types';

export function createViewsWrapper(ctx: WrapperContext) {
  return {
    getActiveOrders: async () => {
      const { data, error } = await ctx.anyClient
        .from('active_orders_view')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    getSalesSummary: async (startDate?: string, endDate?: string) => {
      let query = ctx.anyClient
        .from('sales_summary_view')
        .select('*')
        .order('date', { ascending: false });

      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    getOrderPaymentSummary: async (orderId?: string) => {
      let query = ctx.anyClient
        .from('order_payment_summary')
        .select('*');

      if (orderId) {
        query = query.eq('order_id', orderId);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },
  };
}

export type ViewsWrapper = ReturnType<typeof createViewsWrapper>;
