import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateByClientRequestId } from '@/lib/api/dedupe';
import { notifyNewOrder } from '@/lib/push/notify';

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
      // Order cap is enforced by the `check_order_limit` BEFORE INSERT
      // trigger. Over-cap inserts raise the `plan_required` sentinel
      // (P0001) which handleSupabaseError maps to AuthorizationError,
      // localized at the client via localizeErrorMessage.

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

  // Fire a best-effort staff push for genuinely new orders only (a deduped
  // replay already notified on its first pass). `notifyNewOrder` never throws.
  if (!result.deduped) {
    await notifyNewOrder(supabaseAdmin, {
      tenantId,
      orderNumber: (result.row as { order_number?: string | number | null }).order_number,
    });
  }

  return { order: result.row, deduped: result.deduped };
}
