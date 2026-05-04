import { handleSupabaseError } from '@gustri/api-client';
import { ValidationError } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side refund creation.
 *
 * Authorization is enforced at the route boundary (`verifyAdmin`) — only
 * admin/owner reach this service.
 *
 * Atomicity (Blocker 6, pre-release audit). Refund INSERT, balance check
 * (BEFORE trigger validate_refund_amount), and audit row write (AFTER
 * trigger log_refund_on_insert) all execute in the same transaction
 * inside the `create_refund_with_audit` Postgres function — see
 * migration 20260505000002. The pre-RPC service did the dedupe
 * lookup → INSERT pair via two separate Supabase round trips, so a JS
 * crash between the two could leave the lookup half-completed; not a
 * correctness issue (the unique index protected against duplicate
 * inserts) but the new RPC closes that window and removes the
 * race-recovery branch entirely.
 *
 * Idempotency. `client_request_id` is the dedupe key. The RPC's
 * pre-INSERT SELECT short-circuits sequential retries; concurrent
 * replays serialize on the order-row lock and the loser sees the
 * winner's row in the dedupe lookup on its retry. A 23505 unique
 * violation (the rare path where two replays both miss the lookup) is
 * mapped to a deduped result via the `findExisting` follow-up.
 *
 * Balance authority. The BEFORE INSERT trigger `validate_refund_amount`
 * (migration 20260503000003) takes a row-level lock on the parent order
 * and rechecks `paid - refunded ≥ amount` atomically with the INSERT.
 * The trigger is the SOLE authority on whether a refund fits the
 * available balance. The trigger raises `refund_exceeds_available` with
 * ERRCODE='check_violation', mapped here to a typed `ConflictError(409)`
 * so callers get a stable, machine-readable code.
 *
 * Audit trail. The AFTER INSERT trigger `log_refund_on_insert`
 * (migration 20260503000004) writes one `financial_audit_log` row per
 * successful refund. Because the trigger runs in the RPC's transaction,
 * a failed audit insert rolls back the refund too.
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

const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === PG_UNIQUE_VIOLATION;
}

interface RpcResponse {
  refund: Record<string, unknown>;
  deduped: boolean;
}

async function findExistingByRequestId(
  client: SupabaseClient,
  tenantId: string,
  clientRequestId: string,
) {
  const { data, error } = await client
    .from('refunds')
    .select(REFUND_SELECT)
    .eq('tenant_id', tenantId)
    .eq('client_request_id', clientRequestId)
    .single();
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function createRefund(supabaseAdmin: SupabaseClient, params: CreateRefundParams) {
  const { orderId, refundData, tenantId } = params;

  // Defense-in-depth (Blocker 1). The route schema rejects missing keys,
  // but any future internal caller bypassing the route still gets a
  // typed 400 here rather than silently bypassing dedupe.
  if (!refundData.client_request_id) {
    throw new ValidationError('client_request_id is required', {
      fieldErrors: {
        client_request_id: 'A UUID v4 client_request_id is required for this mutation',
      },
    });
  }

  const { data, error } = await supabaseAdmin.rpc('create_refund_with_audit', {
    p_order_id: orderId,
    p_tenant_id: tenantId,
    p_amount: refundData.amount,
    p_reason: refundData.reason,
    p_refund_method: refundData.refund_method,
    p_processed_by: refundData.processed_by,
    p_order_item_ids: refundData.order_item_ids ?? null,
    p_notes: refundData.notes ?? null,
    p_client_request_id: refundData.client_request_id,
  });

  if (error) {
    // Concurrent dedupe race: the RPC's pre-INSERT lookup missed but the
    // unique index on (tenant_id, client_request_id) rejected the
    // insert. Refetch and return the winner. This branch fires only
    // when two replays land within the same lookup-then-insert window
    // — sequential retries already short-circuit inside the RPC.
    if (isUniqueViolation(error)) {
      const existing = await findExistingByRequestId(
        supabaseAdmin,
        tenantId,
        refundData.client_request_id,
      );
      return { refund: existing, deduped: true };
    }
    throw handleSupabaseError(error);
  }

  // RPC returns jsonb { refund, deduped }.
  const response = data as RpcResponse;
  return { refund: response.refund, deduped: response.deduped };
}
