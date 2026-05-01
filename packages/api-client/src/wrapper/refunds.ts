/**
 * Refunds wrapper module
 */

import { isRefund } from '@gustri/core';
import { handleSupabaseError } from '../errors';
import { dedupeInsert } from './_dedupe';
import { applyTenantScope } from './_tenant-scope';
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
      client_request_id?: string | null;
    }) => {
      const selectShape = `
          *,
          processed_by_staff:staff!refunds_processed_by_fkey(full_name, role)
        `;

      const data = await dedupeInsert<unknown>(refundData.client_request_id, {
        insert: () => ctx.anyClient.from('refunds').insert(refundData).select(selectShape).single(),
        refetch: () =>
          applyTenantScope(
            ctx.anyClient
              .from('refunds')
              .select(selectShape)
              .eq('client_request_id', refundData.client_request_id ?? ''),
            ctx,
          ).single(),
      });

      if (!isRefund(data)) throw new Error('Invalid refund data');
      return data;
    },

    findByOrderId: async (orderId: string) => {
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('refunds')
          .select(`
            *,
            processed_by_staff:staff!refunds_processed_by_fkey(full_name, role)
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
          .from('refunds')
          .select(`
            *,
            processed_by_staff:staff!refunds_processed_by_fkey(full_name, role)
          `)
          .gte('created_at', startDate)
          .lt('created_at', endDate)
          .order('created_at', { ascending: false }),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return data || [];
    },
  };
}

export type RefundsWrapper = ReturnType<typeof createRefundsWrapper>;
