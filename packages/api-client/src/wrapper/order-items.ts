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
import { rpc } from './rpc-typed';
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
     * - Pass `0 < cancelQty < quantity` for a partial cancel: reduces
     *   `quantity` in-place via the `cancel_order_item_qty` RPC, which
     *   takes a row-level lock to avoid lost-update races between
     *   concurrent partial-cancels or partial-cancel + status update.
     * - Pass `cancelQty >= quantity` for an effective full cancel: the
     *   RPC clamps server-side and sets `status: 'cancelled'`. Callers
     *   may pass slider values directly without local clamping.
     *
     * Order totals are recalculated by an `order_items` trigger after
     * the write completes.
     */
    cancel: async (id: string, cancelQty?: number) => {
      if (cancelQty !== undefined && cancelQty > 0) {
        const data = await rpc(ctx, 'cancel_order_item_qty', {
          p_order_item_id: id,
          p_cancel_qty: cancelQty,
        });
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
