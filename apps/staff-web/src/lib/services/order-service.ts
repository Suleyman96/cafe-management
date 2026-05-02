import { PLAN_LIMITS, type PlanName } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateByClientRequestId } from '@/lib/api/dedupe';

/**
 * Server-side order business logic.
 * Runs in API routes with the admin Supabase client.
 */

interface CreateOrderParams {
  orderData: Record<string, unknown> & { client_request_id?: string };
  tenantId: string;
}

/**
 * Validate the tenant's monthly order limit and create an order.
 * Replaces the client-side soft pre-check in useCreateOrder.
 *
 * Idempotent on `client_request_id` when supplied: a replayed mutation
 * skips both the plan-limit check and the insert, returning the original
 * row with `deduped: true` so the route can answer with HTTP 200.
 */
export async function createOrder(supabaseAdmin: SupabaseClient, params: CreateOrderParams) {
  const { orderData, tenantId } = params;

  const result = await findOrCreateByClientRequestId<Record<string, unknown>>(supabaseAdmin, {
    table: 'orders',
    tenantId,
    clientRequestId: orderData.client_request_id,
    selectShape: '*',
    create: async () => {
      // Plan-limit check runs only on a fresh insert path. On replay the
      // helper short-circuits before reaching here, so a tenant whose
      // current month happens to be at the cap won't see a stale paused
      // mutation rejected.
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
          throw new Error(
            `Your ${plan} plan allows up to ${maxOrders} orders/month. Upgrade to add more.`,
          );
        }
      }

      // Strip any client-supplied totals. They are derived server-side —
      // the trigger on order_items rewrites them once items are inserted.
      // Accepting them here would re-open the C2 revenue-theft path.
      const {
        subtotal: _s,
        tax: _t,
        total: _tot,
        ...safeOrderData
      } = orderData as Record<string, unknown> & {
        subtotal?: unknown;
        tax?: unknown;
        total?: unknown;
      };

      const { data, error } = await supabaseAdmin
        .from('orders')
        .insert({
          ...safeOrderData,
          tenant_id: tenantId,
          subtotal: 0,
          tax: 0,
          total: 0,
        })
        .select()
        .single();

      // Pass through the original Postgres error so the helper can detect
      // 23505 on race; wrapping with `new Error()` would lose `.code`.
      if (error) throw error;
      return data;
    },
  });

  return { order: result.row, deduped: result.deduped };
}
