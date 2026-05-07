import { NotFoundError, PLAN_LIMITS, type PlanName } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateByClientRequestId } from '@/lib/api/dedupe';

/**
 * Customer-engagement endpoints — waiter calls and feedback writes.
 *
 * Lifted from the direct-Supabase wrapper path (`db.waiterCalls.create`,
 * `db.feedback.create`) into a server-side service so the route can:
 *
 *   1. Apply per-IP rate limiting via Upstash (H1). The pre-PR3 wrapper
 *      path bypassed the edge limiter entirely.
 *   2. Resolve `tenant_id` from `table_id` server-side. The body's
 *      claimed `tenant_id` (if any) is ignored — same C1 fix that the
 *      customer-orders service applies.
 *   3. Force `status = 'pending'` on insert so a hand-crafted POST
 *      can't pre-acknowledge or pre-resolve its own call.
 *   4. Enforce `PLAN_LIMITS[plan].qrOrdering` (audit M3). Customer
 *      engagement (waiter buzz, feedback) is the same product surface
 *      as customer ordering — both depend on the customer holding a QR
 *      placard. Plans that disable `qrOrdering` (free tier) shouldn't
 *      receive engagement writes either; the customer-orders route has
 *      always gated on this, so applying it here closes the
 *      inconsistency the audit flagged.
 *
 * Tenant resolution is deliberately strict: a `table_id` that doesn't
 * exist throws `NotFoundError` so the route returns 404, not a vague
 * 500. The existing RLS policies on `waiter_calls` /
 * `customer_feedback` already validate `tenant_id ↔ table_id`
 * consistency for the anon role, but the route runs with
 * `supabaseAdmin` (RLS-bypassing) so the service is the trust boundary.
 */

type CreateWaiterCallInput = {
  table_id: string;
  call_type: 'assistance' | 'bill' | 'complaint' | 'question' | 'emergency';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  reason?: string | null;
  notes?: string | null;
  client_request_id: string;
};

type CreateCustomerFeedbackInput = {
  table_id: string;
  order_id?: string | null;
  feedback_type: 'complaint' | 'praise';
  message: string;
};

async function resolveTenantFromTable(
  supabaseAdmin: SupabaseClient,
  tableId: string,
): Promise<string> {
  const { data: table, error } = await supabaseAdmin
    .from('tables')
    .select('id, tenant_id')
    .eq('id', tableId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!table) throw new NotFoundError('Table');
  return table.tenant_id as string;
}

/**
 * Mirrors the gate at `customer-order-service.ts` line ~172. Throws the
 * `plan_required` sentinel that `handleRouteError` maps to HTTP 403. Run
 * AFTER `resolveTenantFromTable` (we need the tenant id) but BEFORE any
 * insert so a free-tier tenant's row count never moves.
 */
async function assertPlanAllowsCustomerEngagement(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
): Promise<void> {
  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .select('plan')
    .eq('id', tenantId)
    .single();
  if (error || !tenant) {
    throw new Error('Tenant not found');
  }
  const plan = ((tenant as { plan?: string }).plan ?? 'free') as PlanName;
  if (!PLAN_LIMITS[plan].qrOrdering) {
    throw new Error('plan_required');
  }
}

/**
 * Idempotent on `client_request_id` via the partial unique index on
 * `waiter_calls(tenant_id, client_request_id)` from migration
 * 20260428000002. A retried POST returns the original row instead of
 * creating a second pending call.
 */
export async function createCustomerWaiterCall(
  supabaseAdmin: SupabaseClient,
  input: CreateWaiterCallInput,
) {
  const tenantId = await resolveTenantFromTable(supabaseAdmin, input.table_id);
  await assertPlanAllowsCustomerEngagement(supabaseAdmin, tenantId);

  return findOrCreateByClientRequestId<Record<string, unknown>>(supabaseAdmin, {
    table: 'waiter_calls',
    tenantId,
    clientRequestId: input.client_request_id,
    selectShape: '*',
    create: async () => {
      const { data, error } = await supabaseAdmin
        .from('waiter_calls')
        .insert({
          tenant_id: tenantId,
          table_id: input.table_id,
          call_type: input.call_type,
          priority: input.priority,
          reason: input.reason ?? null,
          notes: input.notes ?? null,
          status: 'pending',
          client_request_id: input.client_request_id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Record<string, unknown>;
    },
  });
}

/**
 * Customer feedback insert.
 *
 * No `client_request_id` dedupe: the `customer_feedback` table doesn't
 * carry the column today (only `orders`, `order_items`, `payments`,
 * `refunds`, `stock_movements`, `waiter_calls`, `tasks`, `expenses` do
 * — see migration 20260428000002). A duplicate-submit therefore lands
 * twice in the worst case, which is a low-impact UX blemish (staff sees
 * two identical complaint rows) — the H1 rate limiter caps the rate at
 * 3 / 5 min / IP so an attacker can't weaponize the lack of dedupe.
 * Adding the column + index would be a wider migration; defer until a
 * real duplicate-feedback complaint surfaces.
 */
export async function createCustomerFeedback(
  supabaseAdmin: SupabaseClient,
  input: CreateCustomerFeedbackInput,
) {
  const tenantId = await resolveTenantFromTable(supabaseAdmin, input.table_id);
  await assertPlanAllowsCustomerEngagement(supabaseAdmin, tenantId);

  const { data, error } = await supabaseAdmin
    .from('customer_feedback')
    .insert({
      tenant_id: tenantId,
      table_id: input.table_id,
      order_id: input.order_id ?? null,
      feedback_type: input.feedback_type,
      message: input.message,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data as Record<string, unknown>;
}
