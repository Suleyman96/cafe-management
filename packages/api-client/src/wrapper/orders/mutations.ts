/**
 * Orders wrapper — lifecycle mutations (create, status transitions, close,
 * cancel, notes, discount) and the empty-order cleanup RPC.
 */

import { isOrder } from '@gustri/core';
import { handleSupabaseError } from '../../errors';
import { dedupeInsert } from '../_dedupe';
import { applyTenantScope, assertInsertTenantMatches } from '../_tenant-scope';
import { rpc } from '../rpc-typed';
import type { OrderInsert, OrderRow, WrapperContext } from '../types';
import { fetchCurrentVersion, mapDecryptedPii, throwVersionConflict } from './_shared';

export function createOrderMutations(ctx: WrapperContext) {
  return {
    create: async (orderData: OrderInsert) => {
      assertInsertTenantMatches(orderData, ctx);
      // Totals are derived server-side. The existing AFTER INSERT trigger on
      // order_items recomputes subtotal/tax/total once items land, so any
      // client-supplied values would be either ignored (after items) or
      // misleading (orders with no items). Strip them here so the wrapper
      // can't be used to spoof revenue, even if a caller forgets.
      const {
        subtotal: _s,
        tax: _t,
        total: _tot,
        ...safeOrderData
      } = orderData as OrderInsert & {
        subtotal?: unknown;
        tax?: unknown;
        total?: unknown;
      };
      const insertPayload = {
        ...safeOrderData,
        subtotal: 0,
        tax: 0,
        total: 0,
      } as OrderInsert;
      const data = await dedupeInsert<unknown>(orderData.client_request_id, {
        insert: () => ctx.anyClient.from('orders').insert(insertPayload).select().single(),
        refetch: () =>
          applyTenantScope(
            ctx.anyClient
              .from('orders')
              .select()
              .eq('client_request_id', orderData.client_request_id ?? ''),
            ctx,
          ).single(),
      });

      if (!isOrder(data)) throw new Error('Invalid order data');
      return data as OrderRow;
    },

    /**
     * Advance an order's lifecycle status.
     *
     * Enforces two business rules that consumers MUST NOT replicate:
     * - **`served` is dine-in only.** Delivery orders use `out_for_delivery`
     *   → `delivered`; takeout orders go `ready` → `closed` after payment.
     *   Throws if `served` is set on a delivery/takeout order.
     * - **No advancing empty orders.** Statuses `preparing`, `ready`,
     *   `served`, `out_for_delivery`, `delivered` require at least one
     *   non-cancelled item. Throws otherwise.
     *
     * Idempotency: a second call that targets the same status as the row's
     * current value is a no-op — the conditional `.neq('status', status)`
     * filter updates zero rows on replay, and the wrapper re-SELECTs the
     * already-correct row. `clientRequestId` is accepted for future
     * server-side audit-log dedupe; today it is not consumed.
     *
     * Validate at the call site if you need a friendlier UX (the thrown
     * `AppError` is catchable but the message is operator-facing).
     */
    updateStatus: async (
      id: string,
      status: OrderRow['status'],
      options?: { clientRequestId?: string; expectedVersion?: number },
    ) => {
      // Prevent "served" status on delivery and takeout orders
      if (status === 'served') {
        const { data: order, error: fetchError } = await ctx.anyClient
          .from('orders')
          .select('order_type')
          .eq('id', id)
          .single();
        if (fetchError) throw handleSupabaseError(fetchError);
        const orderType = (order as { order_type: string } | null)?.order_type;
        if (orderType === 'delivery') {
          throw new Error(
            'Delivery orders cannot be set to "served". Use "out_for_delivery" instead.',
          );
        }
        if (orderType === 'takeout') {
          throw new Error(
            'Takeout orders cannot be set to "served". Use "ready" and then close after payment.',
          );
        }
      }

      // Prevent advancing empty orders (no non-cancelled items)
      const advanceStatuses: string[] = [
        'preparing',
        'ready',
        'served',
        'out_for_delivery',
        'delivered',
      ];
      if (advanceStatuses.includes(status)) {
        const { data: items } = await ctx.client
          .from('order_items')
          .select('id')
          .eq('order_id', id)
          .neq('status', 'cancelled')
          .limit(1);

        if (!items || items.length === 0) {
          throw new Error(
            'Cannot advance order with no items. Add items first or cancel the order.',
          );
        }
      }

      // Conditional update: only writes rows whose current status differs
      // from the target. A rapid replay (or a second click that races past
      // the disabled-button guard) updates zero rows; we then re-SELECT so
      // callers always get the current row shape.
      //
      // When `expectedVersion` is supplied (Plan 8 feature flag
      // `orders_optimistic_concurrency`), the same UPDATE also filters on
      // `version = expectedVersion`. A 0-row result then has three causes:
      //   1. The row's status already matches `status` (idempotent replay).
      //   2. The row's version moved (concurrency conflict).
      //   3. RLS hid the row.
      // We refetch to disambiguate and surface ConflictError only for (2).
      let updateQuery = ctx.anyClient
        .from('orders')
        .update({ status })
        .eq('id', id)
        .neq('status', status);
      if (options?.expectedVersion !== undefined) {
        updateQuery = updateQuery.eq('version', options.expectedVersion);
      }

      const { data, error } = await updateQuery.select().maybeSingle();

      if (error) throw handleSupabaseError(error);

      if (data) {
        if (!isOrder(data)) throw new Error('Invalid order data');
        return data as OrderRow;
      }

      // Update touched zero rows. Re-SELECT to disambiguate idempotent replay
      // from a concurrency conflict.
      const { data: existing, error: refetchError } = await ctx.anyClient
        .from('orders')
        .select()
        .eq('id', id)
        .single();
      if (refetchError) throw handleSupabaseError(refetchError);
      if (!isOrder(existing)) throw new Error('Invalid order data');

      const existingRow = existing as OrderRow;
      if (
        options?.expectedVersion !== undefined &&
        existingRow.status !== status &&
        existingRow.version !== options.expectedVersion
      ) {
        throwVersionConflict(existingRow.version);
      }
      return existingRow;
    },

    /**
     * Close an order — single dedicated path so the close-unpaid guard
     * (migration 20260506000003) can categorize a write-off in the same
     * UPDATE that flips status to `closed`.
     *
     * Behavior:
     * - Without `forceCloseReason`: equivalent to `updateStatus(id, 'closed')`
     *   plus the BEFORE UPDATE trigger that raises P0002
     *   `order_close_requires_payment_or_reason` if the order still owes
     *   money. handleSupabaseError maps that to ConflictError; the
     *   staff-web hook surfaces the localized close-unpaid modal.
     * - With `forceCloseReason`: the same UPDATE writes status + reason
     *   atomically. The trigger sees a non-null reason and lets the
     *   close through. The reason is the audit record for shift
     *   reconciliation (Plan 14).
     *
     * Authorization is RLS-driven; only roles that can update orders may
     * call this. The state-machine trigger (20260504000007) enforces
     * "non-terminal -> closed" — calling close on an already-closed or
     * cancelled order will reject server-side.
     */
    close: async (
      id: string,
      options?: { forceCloseReason?: string; expectedVersion?: number },
    ) => {
      const update: Record<string, unknown> = { status: 'closed' };
      if (options?.forceCloseReason !== undefined) {
        update.force_close_reason = options.forceCloseReason;
      }

      let updateQuery = ctx.anyClient
        .from('orders')
        .update(update)
        .eq('id', id)
        .neq('status', 'closed');
      if (options?.expectedVersion !== undefined) {
        updateQuery = updateQuery.eq('version', options.expectedVersion);
      }

      const { data, error } = await updateQuery.select().maybeSingle();

      if (error) throw handleSupabaseError(error);

      if (data) {
        if (!isOrder(data)) throw new Error('Invalid order data');
        return data as OrderRow;
      }

      // Already closed (idempotent) or version moved (conflict). Refetch.
      const { data: existing, error: refetchError } = await ctx.anyClient
        .from('orders')
        .select()
        .eq('id', id)
        .single();
      if (refetchError) throw handleSupabaseError(refetchError);
      if (!isOrder(existing)) throw new Error('Invalid order data');

      const existingRow = existing as OrderRow;
      if (
        options?.expectedVersion !== undefined &&
        existingRow.status !== 'closed' &&
        existingRow.version !== options.expectedVersion
      ) {
        throwVersionConflict(existingRow.version);
      }
      return existingRow;
    },

    cancelOrder: async (
      orderId: string,
      reason: string,
      tableId?: string | null,
      options?: { expectedVersion?: number },
    ) => {
      // Update order status to cancelled and store reason in internal_notes.
      // When expectedVersion is supplied, the .eq('version', …) filter
      // surfaces a 0-row UPDATE which we map to ConflictError below.
      let updateQuery = ctx.anyClient
        .from('orders')
        .update({
          status: 'cancelled',
          internal_notes: `Cancelled: ${reason}`,
        })
        .eq('id', orderId);
      if (options?.expectedVersion !== undefined) {
        updateQuery = updateQuery.eq('version', options.expectedVersion);
      }

      const { data, error } = await updateQuery.select().maybeSingle();

      if (error) throw handleSupabaseError(error);
      if (!data) {
        if (options?.expectedVersion !== undefined) {
          throwVersionConflict(await fetchCurrentVersion(ctx, orderId));
        }
        throw new Error('Order not found or RLS denied');
      }
      if (!isOrder(data)) throw new Error('Invalid order data');

      // If the order has a table, check if there are other active orders before setting it to free
      if (tableId) {
        // Check for other active orders on this table
        const { data: otherOrders } = await ctx.client
          .from('orders')
          .select('id')
          .eq('table_id', tableId)
          .in('status', ['pending_approval', 'new', 'preparing', 'ready', 'served'])
          .neq('id', orderId)
          .limit(1);

        // Only set table to free if no other active orders exist
        if (!otherOrders || otherOrders.length === 0) {
          await ctx.anyClient
            .from('tables')
            .update({ status: 'free', occupied_at: null })
            .eq('id', tableId);
        }
      }

      return data as OrderRow;
    },

    updateNotes: async (
      orderId: string,
      notes: { customer_notes?: string | null; internal_notes?: string | null },
    ) => {
      const { data, error } = await ctx.anyClient
        .from('orders')
        .update(notes)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isOrder(data)) throw new Error('Invalid order data');
      return data as OrderRow;
    },

    /**
     * Apply (or clear) a discount on an order.
     *
     * The `recalculate_on_discount_change` Postgres trigger fires on this
     * update and rewrites `subtotal`/`tax`/`total` on the same row. Chaining
     * `.select()` here causes PostgREST to fail with "Cannot coerce the
     * result to a single JSON object", so the implementation does the
     * update WITHOUT `.select()` and then refetches via `orders_decrypted`.
     * This is intentional — do not "fix" by adding `.select()`.
     *
     * Authorization (who can apply discounts) is enforced by RLS, not here.
     */
    applyDiscount: async (
      orderId: string,
      discount: {
        discount_type: 'none' | 'percentage' | 'fixed';
        discount_value: number;
        discount_reason?: string | null;
        discount_applied_by: string;
      },
      options?: { expectedVersion?: number },
    ) => {
      // Don't chain .select() — see JSDoc above. To detect a version
      // conflict without breaking the recalculate-on-update trigger, we
      // gate the UPDATE on `version = expectedVersion` and then sanity
      // check by re-reading version from the refetched row: if the new
      // version did not advance past `expectedVersion`, the UPDATE was
      // a no-op (filtered by the version mismatch) — surface a conflict.
      let updateQuery = ctx.anyClient
        .from('orders')
        .update({
          discount_type: discount.discount_type,
          discount_value: discount.discount_value,
          discount_reason: discount.discount_reason || null,
          discount_applied_by: discount.discount_applied_by,
        })
        .eq('id', orderId);
      if (options?.expectedVersion !== undefined) {
        updateQuery = updateQuery.eq('version', options.expectedVersion);
      }

      const { error } = await updateQuery;

      if (error) throw handleSupabaseError(error);

      // Fetch the updated order after the trigger has recalculated totals
      const { data, error: fetchError } = await ctx.anyClient
        .from('orders_decrypted')
        .select('*')
        .eq('id', orderId)
        .single();

      if (fetchError) throw handleSupabaseError(fetchError);

      const refreshed = mapDecryptedPii(data) as OrderRow;
      if (options?.expectedVersion !== undefined && refreshed.version <= options.expectedVersion) {
        throwVersionConflict(refreshed.version);
      }
      return refreshed;
    },

    /**
     * Bulk-cancel `new` / `pending_approval` orders older than `olderThanMinutes`
     * with no non-cancelled items. Used to reap abandoned QR-flow carts.
     *
     * The RPC requires the caller to have role admin or owner; calls from
     * other staff roles raise `Only admin or owner can clean up empty orders`.
     */
    cleanupEmptyOrders: async (olderThanMinutes = 2) => {
      const data = await rpc(ctx, 'cleanup_empty_orders', {
        p_older_than_minutes: olderThanMinutes,
      });
      const rows = (data ?? []) as unknown as Array<{ cancelled_order_id: string }>;
      return rows.map((row) => row.cancelled_order_id);
    },
  };
}
