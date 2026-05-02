import { NotFoundError, PLAN_LIMITS, type PlanName, ValidationError } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateByClientRequestId } from '@/lib/api/dedupe';

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
  items: Array<{
    menu_item_id: string;
    item_name: string;
    item_price: number;
    quantity: number;
    notes?: string | null;
    tenant_id: string;
    client_request_id?: string;
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
    const { data: table, error } = await supabaseAdmin
      .from('tables')
      .select('id, tenant_id')
      .eq('id', orderData.table_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!table) throw new NotFoundError('Table');
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
      // Get the tenant's plan
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('plan')
        .eq('id', tenantId)
        .single();

      if (tenantError || !tenant) {
        throw new Error('Tenant not found');
      }

      const plan = (tenant.plan ?? 'free') as PlanName;

      // QR-ordering is a paid feature (standard+ per PLAN_LIMITS[*].qrOrdering).
      // Free tenants who try to receive customer-originated orders — the only
      // path through this service — are rejected here. The client UI hides
      // the QR-order entry points but a hand-crafted POST or a forked
      // customer-web build would otherwise reach this insert.
      if (!PLAN_LIMITS[plan].qrOrdering) {
        throw new Error('plan_required');
      }

      const maxOrders = PLAN_LIMITS[plan]?.maxOrdersPerMonth ?? -1;

      if (maxOrders !== -1) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count, error: countError } = await supabaseAdmin
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', startOfMonth.toISOString());

        if (countError) {
          throw new Error('Failed to check order count');
        }

        if ((count ?? 0) >= maxOrders) {
          throw new Error(`Monthly order limit reached for ${plan} plan`);
        }
      }

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
  const { orderId, items } = params;

  if (!items.length) {
    throw new Error('At least one item is required');
  }

  const tenantId = items[0].tenant_id;

  const requestIds = items.map((i) => i.client_request_id);
  const allHaveIds = requestIds.every((id) => typeof id === 'string' && id.length > 0);
  const noneHaveIds = requestIds.every((id) => !id);
  if (!allHaveIds && !noneHaveIds) {
    throw new Error('client_request_id must be set on every item or none');
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

  // Verify order exists and is in an acceptable status
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, status, tenant_id')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single();

  if (orderError || !order) {
    throw new Error('Order not found');
  }

  if (!['pending_approval', 'new', 'preparing'].includes(order.status)) {
    throw new Error('Order is no longer accepting new items');
  }

  // Validate all menu items exist and are available
  const menuItemIds = items.map((i) => i.menu_item_id);
  const { data: menuItems, error: menuError } = await supabaseAdmin
    .from('menu_items')
    .select('id, is_available')
    .in('id', menuItemIds)
    .eq('tenant_id', tenantId);

  if (menuError) {
    throw new Error('Failed to validate menu items');
  }

  const availableIds = new Set((menuItems || []).filter((m) => m.is_available).map((m) => m.id));
  for (const item of items) {
    if (!availableIds.has(item.menu_item_id)) {
      throw new Error(`Menu item ${item.item_name} is not available`);
    }
  }

  // Insert items
  const insertData = items.map((item) => ({
    order_id: orderId,
    menu_item_id: item.menu_item_id,
    item_name: item.item_name,
    item_price: item.item_price,
    quantity: item.quantity,
    notes: item.notes || null,
    status: 'pending' as const,
    tenant_id: tenantId,
    client_request_id: item.client_request_id ?? null,
  }));

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
