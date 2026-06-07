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
import { assertInsertTenantMatches } from './_tenant-scope';
import { rpc } from './rpc-typed';
import type { OrderItemInsert, OrderItemRow, WrapperContext } from './types';

export function createOrderItemsWrapper(ctx: WrapperContext) {
  return {
    // TODO(channel-enforcement): the takeout/delivery pickers filter by
    // `is_takeoutable` / `is_deliverable` client-side, but this insert
    // accepts any menu_item_id. A buggy or malicious staff client could
    // POST a non-deliverable item to a delivery order and the wrapper
    // would happily insert it. Proper fix is a CHECK trigger that joins
    // order → menu_items and rejects when `(order_type, channel_flag)`
    // disagree. Scoped out of the initial channel-flag rollout
    // (20260517000004) because staff-only RLS scope makes the threat
    // model limited. Track in a follow-up issue before opening this to
    // non-staff API consumers.
    create: async (items: OrderItemInsert[]) => {
      // Defense-in-depth on top of RLS: `order_items.Insert.tenant_id` is an
      // optional caller-supplied field, so a buggy or malicious client could
      // post items carrying a foreign tenant_id. Reject any mismatch against
      // the bound context before the insert (RLS would also reject, but this
      // fails fast with a clear AuthorizationError and matches every other
      // tenant-scoped wrapper create). Items that omit tenant_id pass through —
      // the DB fills it from the parent order.
      for (const item of items) {
        assertInsertTenantMatches(item, ctx);
      }
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
