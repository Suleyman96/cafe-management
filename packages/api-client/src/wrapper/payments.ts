/**
 * Payments wrapper module
 */

import { isOrderPayment } from '@gustri/core';
import { handleSupabaseError } from '../errors';
import { dedupeInsert } from './_dedupe';
import { applyTenantScope, assertInsertTenantMatches } from './_tenant-scope';
import type { OrderPaymentInsert, WrapperContext } from './types';

export function createPaymentsWrapper(ctx: WrapperContext) {
  return {
    /**
     * Record a single payment against an order.
     *
     * For multi-payment / split-bill flows, prefer the server route
     * `POST /api/v1/orders/:id/payments` (used by `useCreatePayment`),
     * which runs the order-status update + financial-audit-log write in
     * one transaction. This wrapper method is suitable for single-payment
     * paths (full-bill cash/card) where atomicity isn't critical.
     *
     * The `update_order_payment_status` trigger flips `orders.payment_status`
     * after this insert; clients should refetch the order to see it.
     */
    create: async (paymentData: OrderPaymentInsert) => {
      assertInsertTenantMatches(paymentData, ctx);
      const selectShape = `
          id, tenant_id, order_id, received_by, payment_type,
          amount, tip_amount, payment_method, order_item_ids, notes, created_at,
          received_by_staff:staff!order_payments_received_by_fkey(full_name, role)
        `;

      const data = await dedupeInsert<unknown>(paymentData.client_request_id, {
        insert: () =>
          ctx.anyClient.from('order_payments').insert(paymentData).select(selectShape).single(),
        refetch: () =>
          applyTenantScope(
            ctx.anyClient
              .from('order_payments')
              .select(selectShape)
              .eq('client_request_id', paymentData.client_request_id ?? ''),
            ctx,
          ).single(),
      });

      if (!isOrderPayment(data)) throw new Error('Invalid payment data');
      return data;
    },

    findByOrderId: async (orderId: string) => {
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('order_payments')
          .select(`
            id, tenant_id, order_id, received_by, payment_type,
            amount, tip_amount, payment_method, order_item_ids, notes, created_at,
            received_by_staff:staff!order_payments_received_by_fkey(full_name, role)
          `)
          .eq('order_id', orderId)
          .order('created_at', { ascending: false }),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findByDateRange: async (startDate: string, endDate: string) => {
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('order_payments')
          .select(`
            id, tenant_id, order_id, received_by, payment_type,
            amount, tip_amount, payment_method, order_item_ids, notes, created_at,
            received_by_staff:staff!order_payments_received_by_fkey(full_name, role)
          `)
          .gte('created_at', startDate)
          .lt('created_at', endDate)
          .order('created_at', { ascending: false }),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findByReceivedBy: async (staffId: string, limit = 10) => {
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('order_payments')
          .select(`
            id, tenant_id, order_id, received_by, payment_type,
            amount, tip_amount, payment_method, order_item_ids, notes, created_at
          `)
          .eq('received_by', staffId)
          .order('created_at', { ascending: false })
          .limit(limit),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return data || [];
    },
  };
}

export type PaymentsWrapper = ReturnType<typeof createPaymentsWrapper>;
