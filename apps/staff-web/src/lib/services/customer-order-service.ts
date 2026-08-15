import { ConflictError, NotFoundError, ValidationError } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateByClientRequestId } from '@/lib/api/dedupe';
import { notifyNewOrder } from '@/lib/push/notify';
import { assertCustomerPlanAllowsWrites } from './customer-plan-gate';

type DineInOrderInput = {
  order_type: 'dine_in';
  table_id: string;
  source?: string;
  customer_notes?: string | null;
  client_request_id?: string;
};

type TakeoutOrderInput = {
  order_type: 'takeout';
  qr_token: string;
  source?: string;
  customer_notes?: string | null;
  client_request_id?: string;
};

type DeliveryOrderInput = {
  order_type: 'delivery';
  qr_token: string;
  source?: string;
  customer_notes?: string | null;
  delivery_address: string;
  delivery_phone: string;
  delivery_customer_name?: string | null;
  delivery_fee?: number | null;
  client_request_id?: string;
};

export type CustomerOrderInput = DineInOrderInput | TakeoutOrderInput | DeliveryOrderInput;

interface CreateCustomerOrderParams {
  orderData: CustomerOrderInput;
}

interface AddCustomerOrderItemsParams {
  orderId: string;
  /**
   * The table the caller claims to be at. For dine-in orders (which have a
   * non-null `table_id`) this MUST match the order's table — the same
   * two-factor "M6" bar the cancel endpoints enforce, so knowing only the
   * order UUID is not enough to append items to a stranger's open order.
   * Delivery/takeout orders have no table, so binding doesn't apply to them.
   */
  tableId?: string | null;
  items: Array<{
    menu_item_id: string;
    item_name: string;
    item_price: number;
    quantity: number;
    notes?: string | null;
    tenant_id: string;
    client_request_id?: string;
    // Chosen modifier values (ids only). The server resolves names/prices and
    // recomputes item_price — client-supplied item_price is ignored.
    selected_options?: Array<{ option_id: string; value_id: string }>;
  }>;
}

/**
 * Resolve the tenant_id a customer-web caller is acting on behalf of.
 *
 * Never trusts the request body — that's the C1 vulnerability we're
 * closing. For dine_in we read it off the table row; for takeout/delivery
 * we look up the qr_token row in `qr_tokens`. A failed resolution throws
 * `NotFoundError` / `ValidationError` so the route returns 4xx rather
 * than 500.
 */
async function resolveTenantId(
  supabaseAdmin: SupabaseClient,
  orderData: CustomerOrderInput,
): Promise<{ tenantId: string; tableId: string | null }> {
  if (orderData.order_type === 'dine_in') {
    // Pre-PR4 this only resolved tenant. PR4 also checks the QR-rotation
    // columns (added in 20260507000003) so a customer who scraped a
    // table_id during one visit can't keep submitting orders after
    // their QR code has been rotated or expired by an admin. The
    // wrapper-side `set_table_context` enforces the same checks for
    // the read path; this is the matching write-path enforcement.
    //
    // We swallow nothing — `qr_token_revoked` / `qr_token_expired`
    // surface as ValidationError to the route layer (mirroring the
    // sentinel-shaped exceptions raised by `set_table_context`).
    const { data: table, error } = await supabaseAdmin
      .from('tables')
      .select('id, tenant_id, qr_code_revoked_at, qr_code_expires_at')
      .eq('id', orderData.table_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!table) throw new NotFoundError('Table');
    if (table.qr_code_revoked_at !== null) {
      throw new ValidationError('qr_token_revoked');
    }
    if (
      table.qr_code_expires_at !== null &&
      new Date(table.qr_code_expires_at as string) <= new Date()
    ) {
      throw new ValidationError('qr_token_expired');
    }
    return { tenantId: table.tenant_id as string, tableId: table.id as string };
  }

  const { data: tokenRow, error } = await supabaseAdmin
    .from('qr_tokens')
    .select('tenant_id, table_id, kind, expires_at, revoked_at')
    .eq('token', orderData.qr_token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!tokenRow) throw new ValidationError('invalid_qr_token');

  if (tokenRow.revoked_at !== null) {
    throw new ValidationError('invalid_qr_token');
  }
  if (tokenRow.expires_at !== null && new Date(tokenRow.expires_at as string) <= new Date()) {
    throw new ValidationError('invalid_qr_token');
  }
  if (tokenRow.kind !== orderData.order_type) {
    throw new ValidationError('invalid_qr_token');
  }

  return {
    tenantId: tokenRow.tenant_id as string,
    tableId: (tokenRow.table_id as string | null) ?? null,
  };
}

/**
 * Create an order from the customer-facing app.
 *
 * Tenant binding is derived server-side from `table_id` (dine_in) or
 * `qr_token` (takeout/delivery). The body cannot influence the tenant
 * the order belongs to — that's the whole point of the C1 fix.
 *
 * Idempotent on `client_request_id` when supplied: a customer who taps
 * "place order" twice (or whose connection drops mid-request and retries)
 * gets a single order back rather than two duplicate tickets in the
 * kitchen. Plan-limit and table validation only run on the fresh-insert
 * path — replays short-circuit before either, so a tenant who hits their
 * monthly cap between original and replay still sees the original order
 * succeed instead of being rejected on the retry.
 */
export async function createCustomerOrder(
  supabaseAdmin: SupabaseClient,
  params: CreateCustomerOrderParams,
) {
  const { orderData } = params;

  const { tenantId, tableId } = await resolveTenantId(supabaseAdmin, orderData);

  const result = await findOrCreateByClientRequestId<Record<string, unknown>>(supabaseAdmin, {
    table: 'orders',
    tenantId,
    clientRequestId: orderData.client_request_id,
    selectShape: '*',
    create: async () => {
      // QR-ordering plan gate. Free tenants don't get any customer-side
      // write surface (orders, waiter calls, feedback, delivery) — the
      // helper throws `AuthorizationError('plan_required')` on a free
      // tenant, which `handleRouteError`'s `isAppError` branch maps to
      // HTTP 403 + the localized sentinel.
      await assertCustomerPlanAllowsWrites(supabaseAdmin, tenantId);

      // Order cap is enforced by the `check_order_limit` BEFORE INSERT
      // trigger. Over-cap inserts raise the `plan_required` sentinel
      // (P0001) which handleSupabaseError maps to AuthorizationError.

      const insertRow: Record<string, unknown> = {
        tenant_id: tenantId,
        order_type: orderData.order_type,
        source: orderData.source || 'customer',
        customer_notes: orderData.customer_notes ?? null,
        client_request_id: orderData.client_request_id ?? null,
        status: 'pending_approval',
        subtotal: 0,
        tax: 0,
        total: 0,
      };

      if (orderData.order_type === 'dine_in') {
        insertRow.table_id = tableId;
      } else if (orderData.order_type === 'delivery') {
        insertRow.delivery_address = orderData.delivery_address;
        insertRow.delivery_phone = orderData.delivery_phone;
        insertRow.delivery_customer_name = orderData.delivery_customer_name ?? null;
        insertRow.delivery_fee = orderData.delivery_fee ?? null;
        if (tableId) insertRow.table_id = tableId;
      } else if (tableId) {
        // takeout token may carry a table_id (e.g. counter station) — preserve it
        insertRow.table_id = tableId;
      }

      const { data: order, error: createError } = await supabaseAdmin
        .from('orders')
        .insert(insertRow)
        .select()
        .single();

      // Pass through the original Postgres error so the helper detects 23505.
      if (createError) throw createError;
      return order as Record<string, unknown>;
    },
  });

  // Best-effort kitchen/staff push for genuinely new customer orders. This is
  // the most important push path — a QR order needs to reach the kitchen.
  // Never throws.
  if (!result.deduped) {
    await notifyNewOrder(supabaseAdmin, {
      tenantId,
      orderNumber: (result.row as { order_number?: string | number | null }).order_number,
    });
  }

  return { order: result.row, deduped: result.deduped };
}

/**
 * Add items to an existing customer order.
 *
 * When every item carries a `client_request_id`, the helper short-circuits
 * to the already-persisted rows on replay. The all-or-nothing contract
 * matches the wrapper variant in `order-items.ts`: callers must either
 * stamp every item or none — a mixed payload would let the unique index
 * partially fire and leak duplicates.
 */
export async function addCustomerOrderItems(
  supabaseAdmin: SupabaseClient,
  params: AddCustomerOrderItemsParams,
) {
  const { orderId, tableId, items } = params;

  if (!items.length) {
    throw new Error('At least one item is required');
  }

  const requestIds = items.map((i) => i.client_request_id);
  const allHaveIds = requestIds.every((id) => typeof id === 'string' && id.length > 0);
  const noneHaveIds = requestIds.every((id) => !id);
  if (!allHaveIds && !noneHaveIds) {
    throw new Error('client_request_id must be set on every item or none');
  }

  // Fetch the order by id ALONE first — the tenant is derived from the order
  // row (never trusted from the request body), and the table binding below is
  // the authorization gate. Looking it up by id+body-tenant first (the old
  // path) made tenant_id — a public value — part of the lookup, which is not a
  // capability.
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, status, tenant_id, table_id')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);
  if (!order) throw new NotFoundError('Order');

  // Authorization (M6 / IDOR fix): a dine-in order is bound to its table, so
  // the caller must present the matching table_id — knowing the order UUID
  // alone is not enough. Mirrors the cancel endpoints. Delivery/takeout orders
  // have a null table_id (their capability is the delivery access token), so
  // the table check doesn't apply to them.
  if (order.table_id !== null && order.table_id !== tableId) {
    throw new ValidationError('order_table_mismatch');
  }

  const tenantId = order.tenant_id as string;

  // The inserted rows carry a body-supplied tenant_id; reject any that don't
  // match the order's tenant so a caller can't write rows scoped to a
  // different tenant than the order they're appending to.
  if (items.some((i) => i.tenant_id !== tenantId)) {
    throw new ValidationError('order_item_tenant_mismatch');
  }

  // Replay short-circuit: if any item id is already on disk, the entire
  // batch already committed. Return the persisted rows. Mirrors the
  // batched wrapper path in @gustri/api-client/order-items.
  if (allHaveIds) {
    const ids = requestIds as string[];
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('order_items')
      .select()
      .eq('tenant_id', tenantId)
      .in('client_request_id', ids);
    if (lookupError) throw new Error(lookupError.message);
    if (existing && existing.length > 0) {
      return existing;
    }
  }

  if (!['pending_approval', 'new', 'preparing'].includes(order.status)) {
    throw new Error('Order is no longer accepting new items');
  }

  // Validate all menu items exist + are available, and capture the
  // server-side base price (the client-supplied item_price is NOT trusted).
  const menuItemIds = items.map((i) => i.menu_item_id);
  const { data: menuItems, error: menuError } = await supabaseAdmin
    .from('menu_items')
    .select('id, is_available, price')
    .in('id', menuItemIds)
    .eq('tenant_id', tenantId);

  if (menuError) {
    throw new Error('Failed to validate menu items');
  }

  const menuItemById = new Map((menuItems || []).map((m) => [m.id, m]));
  for (const item of items) {
    const mi = menuItemById.get(item.menu_item_id);
    if (!mi || !mi.is_available) {
      throw new ValidationError(`Menu item ${item.item_name} is not available`);
    }
  }

  // Validate + price selected modifiers SERVER-SIDE. Fetch every option GROUP
  // for these items once — it drives both value validation (a selected value
  // must belong to one of its item's available groups) and required-group
  // completeness. item_price is recomputed as base + Σ value.price_delta so a
  // tampered client price/delta can never reach the order total.
  const optionById = new Map<
    string,
    {
      name: string;
      menu_item_id: string;
      is_available: boolean;
      is_required: boolean;
      min_select: number;
      max_select: number | null;
    }
  >();
  {
    const { data: groups, error: grpError } = await supabaseAdmin
      .from('menu_item_options')
      .select('id, name, menu_item_id, is_available, is_required, min_select, max_select')
      .in('menu_item_id', menuItemIds)
      .eq('tenant_id', tenantId);
    if (grpError) throw new Error('Failed to validate options');
    for (const o of groups || []) {
      optionById.set(o.id, {
        name: o.name,
        menu_item_id: o.menu_item_id,
        is_available: o.is_available,
        is_required: o.is_required,
        min_select: o.min_select,
        max_select: o.max_select,
      });
    }
  }

  const allValueIds = [
    ...new Set(items.flatMap((i) => (i.selected_options ?? []).map((o) => o.value_id))),
  ];
  const valueById = new Map<
    string,
    { option_id: string; price_delta: number; name: string; is_available: boolean }
  >();
  if (allValueIds.length > 0) {
    const { data: values, error: valError } = await supabaseAdmin
      .from('menu_item_option_values')
      .select('id, name, price_delta, is_available, option_id')
      .in('id', allValueIds)
      .eq('tenant_id', tenantId);
    if (valError) throw new Error('Failed to validate options');
    for (const v of values || []) {
      valueById.set(v.id, {
        option_id: v.option_id,
        price_delta: Number(v.price_delta),
        name: v.name,
        is_available: v.is_available,
      });
    }
  }

  // Required-group completeness: every required + available group on an item
  // must have a selection meeting its minimum (and within its max). Server-side
  // counterpart to the customer modal's enforcement — guards the quick-add path
  // and any client that skips the modal.
  for (const item of items) {
    for (const [optionId, group] of optionById) {
      if (group.menu_item_id !== item.menu_item_id || !group.is_required || !group.is_available) {
        continue;
      }
      const count = (item.selected_options ?? []).filter((s) => s.option_id === optionId).length;
      if (count < Math.max(1, group.min_select)) {
        throw new ValidationError('required_option_missing');
      }
      if (group.max_select != null && count > group.max_select) {
        throw new ValidationError('too_many_options');
      }
    }
  }

  // Insert items with server-computed price + an immutable options snapshot.
  const insertData = items.map((item) => {
    const mi = menuItemById.get(item.menu_item_id);
    let unitPrice = Number(mi?.price ?? 0);
    const snapshot: Array<Record<string, unknown>> = [];
    for (const sel of item.selected_options ?? []) {
      const value = valueById.get(sel.value_id);
      if (!value || value.option_id !== sel.option_id || !value.is_available) {
        throw new ValidationError('invalid_option');
      }
      const option = optionById.get(value.option_id);
      if (!option || option.menu_item_id !== item.menu_item_id || !option.is_available) {
        throw new ValidationError('invalid_option');
      }
      unitPrice += value.price_delta;
      snapshot.push({
        option_id: sel.option_id,
        option_name: option.name,
        value_id: sel.value_id,
        value_name: value.name,
        price_delta: value.price_delta,
      });
    }
    return {
      order_id: orderId,
      menu_item_id: item.menu_item_id,
      item_name: item.item_name,
      item_price: unitPrice,
      quantity: item.quantity,
      notes: item.notes || null,
      status: 'pending' as const,
      tenant_id: tenantId,
      client_request_id: item.client_request_id ?? null,
      selected_options: snapshot.length > 0 ? snapshot : null,
    };
  });

  const { data: createdItems, error: insertError } = await supabaseAdmin
    .from('order_items')
    .insert(insertData)
    .select();

  if (insertError) {
    // Concurrent replay won the race — one of our request ids tripped the
    // unique index. Re-fetch and return the persisted rows so the caller
    // sees a successful insert outcome.
    if (allHaveIds && (insertError as { code?: string }).code === '23505') {
      const ids = requestIds as string[];
      const { data: refetched, error: refetchError } = await supabaseAdmin
        .from('order_items')
        .select()
        .eq('tenant_id', tenantId)
        .in('client_request_id', ids);
      if (refetchError) throw new Error(refetchError.message);
      return refetched ?? [];
    }
    throw new Error(insertError.message);
  }

  return createdItems;
}

/**
 * Cancel a customer order from the customer-web flow (M6).
 *
 * Pre-PR the customer-web hook called `db.orders.cancelOrder()` directly,
 * which means anyone holding `order_id` could cancel — relying on the
 * `anon_cancel_early_orders` RLS policy alone, which doesn't pin the
 * cancel to the customer's table. After PR3 narrowed the realtime
 * channel (H5), the leak vector is reduced — but if an attacker had
 * already scraped order_id during a prior visit, they could still grief
 * the customer.
 *
 * This service raises the bar by requiring `tableId` in the request and
 * checking it matches `order.table_id`. An attacker now needs both the
 * order's UUID AND the table's UUID to cancel. Both are anon-readable
 * via the existing `tables` policy, so this isn't bulletproof — a future
 * PR could require the live `qr_code` instead — but it's a meaningful
 * incremental improvement and matches the existing dine-in routing
 * pattern (`tableId` is what the customer-web hook already has on hand).
 *
 * Tenant resolution: derived from the order row server-side. The body
 * cannot influence which tenant the cancellation lands in.
 */
export async function cancelCustomerOrder(
  supabaseAdmin: SupabaseClient,
  args: { orderId: string; tableId: string; reason?: string | null },
) {
  const { orderId, tableId, reason } = args;

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, tenant_id, table_id, status')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new NotFoundError('Order');

  // Pin the cancel to the customer's current table (M6).
  if (order.table_id !== tableId) {
    throw new ValidationError('order_table_mismatch');
  }

  // H3 — differentiate two non-cancellable shapes so the client can
  // localize them distinctly:
  //   - Kitchen has progressed (`preparing` / `ready` / `served` /
  //     `out_for_delivery`): the customer's food is being cooked. UI
  //     should surface a "Call a waiter to discuss" path rather than a
  //     generic error. Sentinel: `order_cancel_too_late`.
  //   - Order already terminal (`closed` / `cancelled` / `delivered`):
  //     there's nothing actionable; surface as `order_not_cancellable`.
  // The RLS policy `anon_cancel_early_orders` blocks the customer-side
  // raw write too, but the route returns a typed sentinel before the
  // RLS path is hit so the client can map cleanly via i18n.
  const kitchenStartedStatuses = ['preparing', 'ready', 'served', 'out_for_delivery'];
  if (kitchenStartedStatuses.includes(order.status as string)) {
    throw new ConflictError('order_cancel_too_late');
  }
  if (!['pending_approval', 'new'].includes(order.status as string)) {
    throw new ConflictError('order_not_cancellable');
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({
      status: 'cancelled',
      internal_notes: `Cancelled: ${reason ?? 'Cancelled by customer'}`,
    })
    .eq('id', orderId)
    .eq('tenant_id', order.tenant_id) // defense-in-depth on the UPDATE
    .select()
    .single();

  if (updateError) throw updateError;
  return updated;
}

/**
 * Cancel an order_item from the customer-web flow (C3).
 *
 * Symmetric with `cancelCustomerOrder` above: the customer-side hook
 * used to call `db.orderItems.cancel()` directly (anon UPDATE through
 * RLS for full cancel, RPC for partial — which only worked for staff).
 * That bypassed both the Upstash limiter and the `table_id`-match
 * defense M6 added for the order-level path.
 *
 * The route layer (`POST /api/v1/customer/orders/[id]/items/[itemId]/cancel`)
 * gates this with rate-limiting; the service itself verifies:
 *
 *   1. The order exists and belongs to a cancellable status.
 *   2. `tableId` matches `order.table_id` — same M6 bar an attacker
 *      with a scraped item_id must clear.
 *   3. The item belongs to that order (so an attacker can't cancel a
 *      different tenant's item by guessing UUIDs paired with their
 *      own order id).
 *   4. The item is in a cancellable status — past `served`/`cancelled`
 *      the kitchen has already invested labor.
 *
 * Partial cancel is done with an atomic UPDATE that decrements
 * `quantity` in a single statement, so two concurrent customer-side
 * cancel taps can't lost-update each other. We don't reuse the
 * `cancel_order_item_qty` RPC because it gates on staff `auth.uid()`
 * — admin-client calls have no `auth.uid()` and would fail
 * authorization. The conditional in the WHERE clause replaces the
 * `FOR UPDATE` lock the RPC takes: the single UPDATE atomically
 * checks `quantity > p_cancel_qty` and decrements, so a racing
 * cancel either commits cleanly or no-ops (returning zero rows).
 */
export async function cancelCustomerOrderItem(
  supabaseAdmin: SupabaseClient,
  args: { orderId: string; itemId: string; tableId: string; cancelQty?: number | null },
) {
  const { orderId, itemId, tableId, cancelQty } = args;

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, tenant_id, table_id, status')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);
  if (!order) throw new NotFoundError('Order');

  if (order.table_id !== tableId) {
    throw new ValidationError('order_table_mismatch');
  }

  // Mirror the order-level cancel gate: pre-kitchen statuses only.
  // Once the kitchen is preparing, item-level cancel becomes a staff
  // decision (waste reason, partial refund) rather than a customer
  // self-serve.
  if (!['pending_approval', 'new'].includes(order.status as string)) {
    throw new ConflictError('order_not_cancellable');
  }

  const { data: item, error: itemError } = await supabaseAdmin
    .from('order_items')
    .select('id, order_id, tenant_id, status, quantity')
    .eq('id', itemId)
    .maybeSingle();
  if (itemError) throw new Error(itemError.message);
  if (!item) throw new NotFoundError('OrderItem');
  if (item.order_id !== orderId || item.tenant_id !== order.tenant_id) {
    throw new ValidationError('order_item_tenant_mismatch');
  }
  if (['cancelled', 'served'].includes(item.status as string)) {
    throw new ConflictError('order_not_cancellable');
  }

  const itemQty = item.quantity as number;
  const isPartial =
    cancelQty !== undefined && cancelQty !== null && cancelQty > 0 && cancelQty < itemQty;

  if (isPartial) {
    // Atomic decrement: `quantity > $1` in the WHERE clause is the
    // race-loss guard. If a concurrent cancel already brought
    // quantity to <= p_cancel_qty, this UPDATE matches zero rows
    // and `.single()` raises — caller retries or refetches.
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('order_items')
      .update({ quantity: itemQty - cancelQty })
      .eq('id', itemId)
      .eq('tenant_id', order.tenant_id)
      .gt('quantity', cancelQty)
      .select()
      .single();
    if (updateError) throw updateError;
    return updated;
  }

  // Full cancel — `cancelQty >= itemQty` collapses to status update,
  // matching the wrapper's clamp-on-the-server contract.
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('order_items')
    .update({ status: 'cancelled' })
    .eq('id', itemId)
    .eq('tenant_id', order.tenant_id)
    .select()
    .single();
  if (updateError) throw updateError;
  return updated;
}
