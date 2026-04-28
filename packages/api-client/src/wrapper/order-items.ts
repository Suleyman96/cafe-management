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
import { dedupeInsertMany } from './_dedupe';
import type { OrderItemInsert, OrderItemRow, WrapperContext } from './types';

export function createOrderItemsWrapper(ctx: WrapperContext) {
  return {
    create: async (items: OrderItemInsert[]) => {
      const requestIds = items.map((item) => item.client_request_id);
      const data = await dedupeInsertMany<unknown>(requestIds, {
        insert: () => ctx.anyClient.from('order_items').insert(items).select(),
        refetchByIds: (ids) =>
          ctx.anyClient.from('order_items').select().in('client_request_id', ids),
      });

      if (!isOrderItemArray(data)) throw new Error('Invalid order items data');
      return data as OrderItemRow[];
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

    /**
     * Cancel an order item — fully or partially.
     *
     * - Omit `cancelQty` (or pass `0`/`undefined`) for a full cancel:
     *   sets `status: 'cancelled'`. Item still appears on the order with
     *   strikethrough on the UI.
     * - Pass `cancelQty < quantity` for a partial cancel: reduces
     *   `quantity` in-place. The item stays in its current status; only
     *   the quantity changes. The kitchen display will reflect the new
     *   quantity.
     * - Pass `cancelQty >= quantity` for an effective full cancel: sets
     *   `status: 'cancelled'` (NOT a quantity change). This branch exists
     *   so callers can pass the slider value directly without clamping.
     *
     * Each branch is a separate Supabase round-trip — no transaction. If
     * the partial branch's update fails after the read, the item is
     * unchanged. Order totals are recalculated by an `order_items` trigger
     * after the write completes.
     */
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
