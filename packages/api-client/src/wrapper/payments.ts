/**
 * Payments wrapper module
 */

import { handleSupabaseError, isOrderPayment } from '@gustri/core';
import type { OrderPaymentInsert, WrapperContext } from './types';

export function createPaymentsWrapper(ctx: WrapperContext) {
  return {
    create: async (paymentData: OrderPaymentInsert) => {
      const { data, error } = await ctx.anyClient
        .from('order_payments')
        .insert(paymentData)
        .select(`
          id, tenant_id, order_id, received_by, payment_type,
          amount, tip_amount, payment_method, order_item_ids, notes, created_at,
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
          id, tenant_id, order_id, received_by, payment_type,
          amount, tip_amount, payment_method, order_item_ids, notes, created_at,
          received_by_staff:staff!order_payments_received_by_fkey(full_name, role)
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findByDateRange: async (startDate: string, endDate: string) => {
      const { data, error } = await ctx.client
        .from('order_payments')
        .select(`
          id, tenant_id, order_id, received_by, payment_type,
          amount, tip_amount, payment_method, order_item_ids, notes, created_at,
          received_by_staff:staff!order_payments_received_by_fkey(full_name, role)
        `)
        .gte('created_at', startDate)
        .lt('created_at', endDate)
        .order('created_at', { ascending: false });

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findByReceivedBy: async (staffId: string, limit = 10) => {
      const { data, error } = await ctx.client
        .from('order_payments')
        .select(`
          id, tenant_id, order_id, received_by, payment_type,
          amount, tip_amount, payment_method, order_item_ids, notes, created_at
        `)
        .eq('received_by', staffId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw handleSupabaseError(error);
      return data || [];
    },
  };
}

export type PaymentsWrapper = ReturnType<typeof createPaymentsWrapper>;
