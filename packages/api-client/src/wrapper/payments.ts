/**
 * Payments wrapper module
 */

import { handleSupabaseError, isOrderPayment } from '@cafe-idare/core';
import type { OrderPaymentInsert, WrapperContext } from './types';

export function createPaymentsWrapper(ctx: WrapperContext) {
  return {
    create: async (paymentData: OrderPaymentInsert) => {
      const { data, error } = await ctx.anyClient
        .from('order_payments')
        .insert(paymentData)
        .select(`
          *,
          received_by_staff:staff!order_payments_received_by_fkey(full_name, role)
        `)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrderPayment(data)) throw new Error('Invalid payment data');
      return data;
    },

    findByOrderId: async (orderId: string) => {
      const { data, error } = await ctx.client
        .from('order_payments')
        .select(`
          *,
          received_by_staff:staff!order_payments_received_by_fkey(full_name, role)
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findByReceivedBy: async (staffId: string, limit = 10) => {
      const { data, error } = await ctx.client
        .from('order_payments')
        .select('*')
        .eq('received_by', staffId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw handleSupabaseError(error);
      return data || [];
    },
  };
}

export type PaymentsWrapper = ReturnType<typeof createPaymentsWrapper>;
