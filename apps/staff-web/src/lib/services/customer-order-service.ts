import { PLAN_LIMITS, type PlanName } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';

interface CreateCustomerOrderParams {
  orderData: {
    table_id?: string | null;
    tenant_id: string;
    order_type: string;
    source?: string;
    customer_notes?: string | null;
    delivery_address?: string | null;
    delivery_phone?: string | null;
    delivery_customer_name?: string | null;
    delivery_fee?: number | null;
  };
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
  }>;
}

/**
 * Create an order from the customer-facing app.
 * Validates tenant plan limits using tenant_id from the request body.
 */
export async function createCustomerOrder(
  supabaseAdmin: SupabaseClient,
  params: CreateCustomerOrderParams,
) {
  const { orderData } = params;
  const tenantId = orderData.tenant_id;

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

  // Validate table exists if dine_in
  if (orderData.order_type === 'dine_in' && orderData.table_id) {
    const { data: table, error: tableError } = await supabaseAdmin
      .from('tables')
      .select('id, tenant_id')
      .eq('id', orderData.table_id)
      .eq('tenant_id', tenantId)
      .single();

    if (tableError || !table) {
      throw new Error('Table not found');
    }
  }

  // Create the order
  const { data: order, error: createError } = await supabaseAdmin
    .from('orders')
    .insert({
      ...orderData,
      tenant_id: tenantId,
      source: orderData.source || 'customer',
      status: 'pending_approval',
      subtotal: 0,
      tax: 0,
      total: 0,
    })
    .select()
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  return order;
}

/**
 * Add items to an existing customer order.
 * Validates the order exists and is in a state that accepts new items.
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
  }));

  const { data: createdItems, error: insertError } = await supabaseAdmin
    .from('order_items')
    .insert(insertData)
    .select();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return createdItems;
}
