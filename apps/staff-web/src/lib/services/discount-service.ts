import { handleSupabaseError } from '@gustri/api-client';
import { DISCOUNT_AUDIT_THRESHOLD, ValidationError } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side discount validation and application.
 *
 * Authorization is enforced at the route boundary (`verifyAdmin`) — only
 * admin/owner reach this service. Per-role caps were removed in the
 * second-pass audit fix: the previous "cap by role" branch let waiters
 * apply small discounts without a paper trail, while the UI already
 * hid the button from non-admins. Centralizing the gate at the route
 * removes that schism.
 *
 * Atomicity (Blocker 6, pre-release audit). The pre-fix flow ran the
 * orders UPDATE and the `discount_applied` financial_audit_log INSERT
 * as two separate Supabase round trips (and therefore two separate
 * transactions). If the audit INSERT failed, the discount was already
 * committed and an operator-visible `console.warn` was the only trace.
 * The new `apply_discount_with_audit` Postgres function (migration
 * 20260505000003) executes both writes in one transaction. A failed
 * audit insert now rolls back the UPDATE, eliminating the "best-effort
 * logging" branch entirely.
 *
 * Idempotency. The audit table carries a partial unique index on
 *   (tenant_id, action='discount_applied', client_request_id) — see
 * migration 20260504000002. The RPC's pre-INSERT lookup short-circuits
 * sequential retries; concurrent replays serialize on the order-row
 * lock and the loser sees the winner's audit row on its retry. A 23505
 * unique violation (the rare double-miss path) is mapped here to a
 * deduped result via a follow-up SELECT.
 *
 * Validation split. Sanity caps (percentage 0–100, fixed ≤ subtotal,
 * large-discount reason requirement) STAY in this service — the route's
 * Zod schema already validates shape, but the order-context-dependent
 * checks (subtotal upper bound, fraction-vs-threshold) need an order
 * read and produce structured `fieldErrors` for UI feedback. The RPC
 * only enforces shape-of-last-resort (discount_type membership, value
 * sign) so an internal caller bypassing the service can't write
 * nonsense.
 */

const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === PG_UNIQUE_VIOLATION;
}

interface ApplyDiscountParams {
  orderId: string;
  discountType: 'none' | 'percentage' | 'fixed';
  discountValue: number;
  discountReason?: string | null;
  discountAppliedBy: string;
  clientRequestId?: string;
  tenantId: string;
}

interface OrderRow {
  id: string;
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  discount_type: string;
  discount_value: number | string;
  discount_amount: number | string;
}

interface RpcResponse {
  order: OrderRow;
  deduped: boolean;
}

async function fetchOrderForRefetch(supabaseAdmin: SupabaseClient, orderId: string) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id, subtotal, tax, total, discount_type, discount_value, discount_amount')
    .eq('id', orderId)
    .single();
  if (error) throw handleSupabaseError(error);
  return data as OrderRow;
}

export async function applyDiscount(supabaseAdmin: SupabaseClient, params: ApplyDiscountParams) {
  const { orderId, discountType, discountReason, discountAppliedBy, clientRequestId, tenantId } =
    params;
  let { discountValue } = params;

  // Defense-in-depth (Blocker 1). The route schema rejects missing keys;
  // this throw is for any future internal caller that bypasses the route.
  if (!clientRequestId) {
    throw new ValidationError('client_request_id is required', {
      fieldErrors: {
        client_request_id: 'A UUID v4 client_request_id is required for this mutation',
      },
    });
  }

  // Read the order's subtotal first — sanity caps below depend on it,
  // and the dedupe lookup happens inside the RPC. We also use this
  // SELECT as the tenant-scope check: cross-tenant order ids resolve
  // to NotFoundError here so the route returns a clean 404, before any
  // RPC round trip.
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, subtotal, tenant_id')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single();

  if (orderError || !order) {
    throw handleSupabaseError(orderError ?? { code: 'PGRST116', message: 'Order' });
  }

  const subtotal = Number(order.subtotal) || 0;

  // Validate discount shape. Clamp to 0 when removing — a negative value
  // left by a buggy/malicious client would otherwise persist and
  // re-activate if the type is later flipped back to 'fixed' without
  // clearing the value. Sanity-cap violations are caller errors (400),
  // not server errors (500), so throw `ValidationError` which the
  // route's `handleRouteError` maps to 400.
  if (discountType === 'none') {
    discountValue = 0;
  } else if (discountType === 'percentage') {
    if (discountValue <= 0 || discountValue > 100) {
      throw new ValidationError('discount_value_out_of_range', {
        fieldErrors: { discount_value: 'Percentage discount must be between 0 and 100' },
      });
    }
  } else if (discountType === 'fixed') {
    if (discountValue <= 0) {
      throw new ValidationError('discount_value_out_of_range', {
        fieldErrors: { discount_value: 'Fixed discount must be greater than 0' },
      });
    }
    if (discountValue > subtotal) {
      throw new ValidationError('discount_value_out_of_range', {
        fieldErrors: { discount_value: 'Fixed discount cannot exceed order subtotal' },
      });
    }
  }

  // Reason requirement on large comps. Authorization is already handled
  // at the route (admin/owner only); this gate only enforces forensic
  // quality so the audit trail is usable when reconciling.
  if (discountType !== 'none') {
    const requestedFraction =
      discountType === 'percentage'
        ? discountValue / 100
        : subtotal > 0
          ? discountValue / subtotal
          : 1;
    if (requestedFraction >= DISCOUNT_AUDIT_THRESHOLD) {
      if (!discountReason || discountReason.trim().length < 5) {
        throw new ValidationError('discount_reason_required', {
          fieldErrors: {
            discount_reason: 'Reason required for large discounts (≥5 chars)',
          },
        });
      }
    }
  }

  const { data, error } = await supabaseAdmin.rpc('apply_discount_with_audit', {
    p_order_id: orderId,
    p_tenant_id: tenantId,
    p_discount_type: discountType,
    p_discount_value: discountValue,
    p_discount_reason: discountReason ?? null,
    p_discount_applied_by: discountAppliedBy,
    p_client_request_id: clientRequestId,
  });

  if (error) {
    // Concurrent dedupe race: the RPC's lookup missed but the partial
    // unique index rejected the audit insert. The other replay's UPDATE
    // is already committed — refetch and return as deduped.
    if (isUniqueViolation(error)) {
      const refetched = await fetchOrderForRefetch(supabaseAdmin, orderId);
      return { order: refetched, deduped: true };
    }
    throw handleSupabaseError(error);
  }

  const response = data as RpcResponse;
  return { order: response.order, deduped: response.deduped };
}
