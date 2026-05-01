/**
 * Database views wrapper module
 *
 * Uses anyClient because views (active_orders_view, sales_summary_view,
 * order_payment_summary) are not represented in the generated Database type.
 */

import { handleSupabaseError } from '../errors';
import { applyTenantScope } from './_tenant-scope';
import type { WrapperContext } from './types';

export function createViewsWrapper(ctx: WrapperContext) {
  return {
    getSalesSummary: async (startDate?: string, endDate?: string) => {
      let query = applyTenantScope(
        ctx.anyClient.from('sales_summary_view').select('*').order('date', { ascending: false }),
        ctx,
      );

      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }

      query = query.limit(500);

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    getOrderPaymentSummary: async (orderId?: string) => {
      let query = applyTenantScope(ctx.anyClient.from('order_payment_summary').select('*'), ctx);

      if (orderId) {
        query = query.eq('order_id', orderId);
      }

      query = query.limit(500);

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },
  };
}

export type ViewsWrapper = ReturnType<typeof createViewsWrapper>;
