/**
 * Order items wrapper module
 *
 * Split out from orders.ts in 2026-04 — the combined file was 650 LOC and the
 * busiest merge-conflict zone in the wrapper layer. Order-level operations
 * (lifecycle, status, discounts) live in `orders.ts`; per-item operations
 * (create, status, cancel with partial quantity) live here.
 */

import { isOrderItem, isOrderItemArray } from '@gustri/core';
import { handleSupabaseError } from '../errors';
import type { OrderItemInsert, OrderItemRow, WrapperContext } from './types';

export function createOrderItemsWrapper(ctx: WrapperContext) {
  return {
    create: async (items: OrderItemInsert[]) => {
      const { data, error } = await ctx.anyClient.from('order_items').insert(items).select();

      if (error) throw handleSupabaseError(error);
      const orderItems = data || [];
      if (!isOrderItemArray(orderItems)) throw new Error('Invalid order items data');
      return orderItems as OrderItemRow[];
    },

    updateStatus: async (id: string, status: OrderItemRow['status']) => {
      const { data, error } = await ctx.anyClient
        .from('order_items')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrderItem(data)) throw new Error('Invalid order item data');
      return data as OrderItemRow;
    },

    delete: async (id: string) => {
      const { error } = await ctx.anyClient.from('order_items').delete().eq('id', id);

      if (error) throw handleSupabaseError(error);
    },

    cancel: async (id: string, cancelQty?: number) => {
      if (cancelQty !== undefined && cancelQty > 0) {
        // Partial cancel: fetch current item, reduce quantity, or cancel if all
        const { data: current, error: fetchError } = await ctx.anyClient
          .from('order_items')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) throw handleSupabaseError(fetchError);
        if (!current) throw new Error('Order item not found');
        const currentItem = current as OrderItemRow;

        if (cancelQty >= currentItem.quantity) {
          const { data, error } = await ctx.anyClient
            .from('order_items')
            .update({ status: 'cancelled' })
            .eq('id', id)
            .select()
            .single();
          if (error) throw handleSupabaseError(error);
          if (!isOrderItem(data)) throw new Error('Invalid order item data');
          return data as OrderItemRow;
        }

        const { data, error } = await ctx.anyClient
          .from('order_items')
          .update({ quantity: currentItem.quantity - cancelQty })
          .eq('id', id)
          .select()
          .single();
        if (error) throw handleSupabaseError(error);
        if (!isOrderItem(data)) throw new Error('Invalid order item data');
        return data as OrderItemRow;
      }

      const { data, error } = await ctx.anyClient
        .from('order_items')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrderItem(data)) throw new Error('Invalid order item data');
      return data as OrderItemRow;
    },
  };
}

export type OrderItemsWrapper = ReturnType<typeof createOrderItemsWrapper>;
