/**
 * Database views wrapper module
 *
 * Uses anyClient because views (active_orders_view, sales_summary_view,
 * order_payment_summary) are not represented in the generated Database type.
 */

import { handleSupabaseError } from '@gustri/core';
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
      let query = ctx.anyClient.from('order_payment_summary').select('*');

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
