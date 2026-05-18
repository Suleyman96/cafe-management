import { NotFoundError } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateByClientRequestId } from '@/lib/api/dedupe';
import { assertCustomerPlanAllowsWrites } from './customer-plan-gate';

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
  client_request_id: string;
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
  await assertCustomerPlanAllowsWrites(supabaseAdmin, tenantId);

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
 * Idempotent on `client_request_id` via the partial unique index on
 * `customer_feedback(tenant_id, client_request_id)` from migration
 * 20260517000001 (S4). A retried POST returns the original row instead
 * of stamping a second complaint in the staff queue. The H1 rate
 * limiter (3 / 5 min / IP) still caps the worst case; this just closes
 * the within-window double-submit path.
 */
export async function createCustomerFeedback(
  supabaseAdmin: SupabaseClient,
  input: CreateCustomerFeedbackInput,
) {
  const tenantId = await resolveTenantFromTable(supabaseAdmin, input.table_id);
  await assertCustomerPlanAllowsWrites(supabaseAdmin, tenantId);

  return findOrCreateByClientRequestId<Record<string, unknown>>(supabaseAdmin, {
    table: 'customer_feedback',
    tenantId,
    clientRequestId: input.client_request_id,
    selectShape: '*',
    create: async () => {
      const { data, error } = await supabaseAdmin
        .from('customer_feedback')
        .insert({
          tenant_id: tenantId,
          table_id: input.table_id,
          order_id: input.order_id ?? null,
          feedback_type: input.feedback_type,
          message: input.message,
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
