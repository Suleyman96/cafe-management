import { AppError } from '@gustri/core';
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
 * H1 + L2 — reject cross-tenant foreign keys on order create.
 *
 * The order insert uses the service-role client (RLS bypassed), so a client
 * that supplies a `table_id` / `assigned_waiter_id` / `delivery_customer_id`
 * belonging to ANOTHER tenant would otherwise be persisted verbatim — and the
 * `update_table_status_on_order` trigger would then corrupt that other tenant's
 * table row. Verify every supplied FK belongs to the order's own tenant BEFORE
 * the insert. Each check is a single indexed lookup on (id, tenant_id).
 *
 * The thrown codes are snake_case sentinels (see @gustri/i18n error-keys) so the
 * client localizes them; a 404 is used so a probe can't distinguish
 * "belongs to another tenant" from "does not exist".
 */
async function assertBelongsToTenant(
  supabaseAdmin: SupabaseClient,
  table: 'tables' | 'staff' | 'delivery_customers',
  id: string,
  tenantId: string,
  sentinel: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    throw new Error(`order-create: ${table} tenant check failed (${error.message})`);
  }
  if (!data) {
    throw new AppError(sentinel, 'NOT_FOUND', 404);
  }
}

/**
 * Validate the tenant ownership of every FK the caller may supply on an order.
 * Only runs for ids that are actually present (all three are optional).
 */
async function validateOrderTenantScope(
  supabaseAdmin: SupabaseClient,
  orderData: Record<string, unknown>,
  tenantId: string,
): Promise<void> {
  const tableId = orderData.table_id;
  if (typeof tableId === 'string' && tableId) {
    await assertBelongsToTenant(
      supabaseAdmin,
      'tables',
      tableId,
      tenantId,
      'table_tenant_mismatch',
    );
  }

  const waiterId = orderData.assigned_waiter_id;
  if (typeof waiterId === 'string' && waiterId) {
    await assertBelongsToTenant(
      supabaseAdmin,
      'staff',
      waiterId,
      tenantId,
      'waiter_tenant_mismatch',
    );
  }

  const deliveryCustomerId = orderData.delivery_customer_id;
  if (typeof deliveryCustomerId === 'string' && deliveryCustomerId) {
    await assertBelongsToTenant(
      supabaseAdmin,
      'delivery_customers',
      deliveryCustomerId,
      tenantId,
      'delivery_customer_tenant_mismatch',
    );
  }
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
      // H1 + L2: reject cross-tenant table_id / assigned_waiter_id /
      // delivery_customer_id BEFORE the service-role insert. Runs inside the
      // create path (after the dedupe miss) so a replayed order doesn't
      // re-validate, but every genuinely new insert is guarded.
      await validateOrderTenantScope(supabaseAdmin, orderData, tenantId);

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
