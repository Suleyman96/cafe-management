import { PLAN_LIMITS, type PlanName } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side order business logic.
 * Runs in API routes with the admin Supabase client.
 */

interface CreateOrderParams {
  orderData: Record<string, unknown>;
  tenantId: string;
}

/**
 * Validate the tenant's monthly order limit and create an order.
 * Replaces the client-side soft pre-check in useCreateOrder.
 */
export async function createOrder(supabaseAdmin: SupabaseClient, params: CreateOrderParams) {
  const { orderData, tenantId } = params;

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

  // Enforce plan limit (authoritative server-side check)
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
      throw new Error(
        `Your ${plan} plan allows up to ${maxOrders} orders/month. Upgrade to add more.`,
      );
    }
  }

  // Create the order
  const { data: order, error: createError } = await supabaseAdmin
    .from('orders')
    .insert({ ...orderData, tenant_id: tenantId })
    .select()
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  return order;
}
