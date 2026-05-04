import { handleSupabaseError } from '@gustri/api-client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateByClientRequestId } from '@/lib/api/dedupe';

/**
 * Server-side refund creation.
 *
 * Authorization is enforced at the route boundary (`verifyAdmin`) — only
 * admin/owner reach this service.
 *
 * Balance authority. The BEFORE INSERT trigger `validate_refund_amount`
 * (migration 20260503000003) takes a row-level lock on the parent order
 * and rechecks `paid - refunded ≥ amount` atomically with the INSERT.
 * The trigger is the SOLE authority on whether a refund fits the available
 * balance. This service used to perform a parallel pre-check via two
 * un-locked SELECTs over `order_payments` and `refunds`; under READ
 * COMMITTED a concurrent payment between the two reads could let the
 * comparison pass while the trigger correctly rejected the INSERT,
 * surfacing a 5xx instead of a friendly 409. The pre-check was removed.
 * The trigger raises `refund_exceeds_available` with
 * ERRCODE='check_violation', which `handleSupabaseError` maps to a typed
 * `ConflictError(409)` so callers get a stable, machine-readable code.
 *
 * Idempotency. `client_request_id` is the dedupe key — see
 * `findOrCreateByClientRequestId`. On replay the helper short-circuits
 * before this body runs and returns the row from the first attempt; we
 * never re-tally totals here. That matters because by the time a paused
 * refund mutation replays, additional refunds may have left the available
 * balance below the replayed amount, and we don't want the
 * already-applied refund to be falsely rejected.
 *
 * Audit trail. The AFTER INSERT trigger `log_refund_on_insert` (migration
 * 20260503000004) writes one `financial_audit_log` row per successful
 * refund — no audit work is needed in this service.
 */

interface CreateRefundParams {
  orderId: string;
  refundData: {
    amount: number;
    reason: string;
    refund_method: string;
    processed_by: string;
    order_item_ids?: string[] | null;
    notes?: string | null;
    client_request_id?: string;
  };
  tenantId: string;
}

const REFUND_SELECT = `
  *,
  processed_by_staff:staff!refunds_processed_by_fkey(full_name, role)
`;

export async function createRefund(supabaseAdmin: SupabaseClient, params: CreateRefundParams) {
  const { orderId, refundData, tenantId } = params;

  const result = await findOrCreateByClientRequestId<Record<string, unknown>>(supabaseAdmin, {
    table: 'refunds',
    tenantId,
    clientRequestId: refundData.client_request_id,
    selectShape: REFUND_SELECT,
    create: async () => {
      // Verify the order exists in this tenant before issuing the INSERT.
      // The trigger would also reject a foreign-tenant row via
      // `refund_tenant_mismatch`, but doing the check here gives the route a
      // clean 404 (not-found in this tenant) instead of a 409, and avoids
      // leaking cross-tenant existence — `.single()` returns PGRST116 when
      // 0 rows match, which `handleSupabaseError` maps to NotFoundError.
      const { error: orderError } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('id', orderId)
        .eq('tenant_id', tenantId)
        .single();

      if (orderError) throw handleSupabaseError(orderError);

      const { data: refund, error: createError } = await supabaseAdmin
        .from('refunds')
        .insert({
          order_id: orderId,
          tenant_id: tenantId,
          amount: refundData.amount,
          reason: refundData.reason,
          refund_method: refundData.refund_method,
          processed_by: refundData.processed_by,
          order_item_ids: refundData.order_item_ids || null,
          notes: refundData.notes || null,
          client_request_id: refundData.client_request_id ?? null,
        })
        .select(REFUND_SELECT)
        .single();

      if (createError) {
        // Let `findOrCreateByClientRequestId` recover from a concurrent-replay
        // race by detecting raw 23505. Wrapping into ConflictError here would
        // erase the original PG code and prevent the helper's race-recovery
        // refetch. For every other error (notably the trigger's check_violation
        // sentinel `refund_exceeds_available`) translate to a typed AppError
        // so handleRouteError returns a stable 409 instead of falling through
        // to a 500 Sentry capture.
        if ((createError as { code?: string }).code === '23505') throw createError;
        throw handleSupabaseError(createError);
      }
      return refund;
    },
  });

  return { refund: result.row, deduped: result.deduped };
}
