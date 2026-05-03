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
 * Idempotency: the discount UPDATE itself writes absolute values
 * (`discount_type`, `discount_value`) — not deltas — so re-applying with
 * the same payload yields the same order state. The audit log INSERT,
 * however, is NOT idempotent: a replayed mutation would produce a second
 * `discount_applied` row, polluting reconciliation. To dedupe we stamp
 * `client_request_id` into `details` on the audit row and look it up on
 * subsequent calls; if found, we short-circuit and return the current
 * order without re-applying or re-logging. There is no unique constraint
 * on the audit table — concurrent replays can in theory both miss the
 * lookup and both insert — but since the discount UPDATE is idempotent,
 * the worst case is two audit rows with the same client_request_id
 * (rare, and a unique index can be added later without breaking anything).
 *
 * Audit trail: EVERY non-zero discount writes a `financial_audit_log`
 * row. Even a 5%-off concession is finance-relevant; the prior threshold
 * gate hid small comps from reconciliation. Discounts above
 * `DISCOUNT_AUDIT_THRESHOLD` additionally require a non-trivial reason
 * (≥5 chars) so large comps are forensically usable.
 *
 * Sanity caps stay (percentage 0-100, fixed ≤ subtotal) — these are
 * shape guards, not authorization decisions.
 */

interface ApplyDiscountParams {
  orderId: string;
  discountType: 'none' | 'percentage' | 'fixed';
  discountValue: number;
  discountReason?: string | null;
  discountAppliedBy: string;
  clientRequestId?: string;
  tenantId: string;
}

async function fetchOrder(supabaseAdmin: SupabaseClient, orderId: string) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id, subtotal, tax, total, discount_type, discount_value, discount_amount')
    .eq('id', orderId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function applyDiscount(supabaseAdmin: SupabaseClient, params: ApplyDiscountParams) {
  const { orderId, discountType, discountReason, discountAppliedBy, clientRequestId, tenantId } =
    params;
  let { discountValue } = params;

  // Replay short-circuit: if a prior call with the same client_request_id
  // already wrote a `discount_applied` audit row, the discount UPDATE has
  // already run (or, since the UPDATE is idempotent on absolute values, is
  // safe to skip). Returning early avoids a duplicate audit entry.
  if (clientRequestId) {
    const { data: existingAudit, error: auditLookupError } = await supabaseAdmin
      .from('financial_audit_log')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('order_id', orderId)
      .eq('action', 'discount_applied')
      .eq('details->>client_request_id', clientRequestId)
      .maybeSingle();
    if (auditLookupError) throw new Error(auditLookupError.message);
    if (existingAudit) {
      return { order: await fetchOrder(supabaseAdmin, orderId), deduped: true };
    }
  }

  // Verify the order belongs to this tenant
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, subtotal, tenant_id')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single();

  if (orderError || !order) {
    throw new Error('Order not found');
  }

  const subtotal = Number(order.subtotal) || 0;

  // Validate discount shape. Clamp to 0 when removing — a negative value left
  // by a buggy/malicious client would otherwise persist and re-activate if the
  // type is later flipped back to 'fixed' without clearing the value.
  // Sanity-cap violations are caller errors (400), not server errors (500),
  // so throw `ValidationError` which the route's `handleRouteError` maps to 400.
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

  // Apply discount — the DB trigger recalculate_on_discount_change handles totals.
  // Don't chain .select() to avoid PostgREST "Cannot coerce" errors
  // from the AFTER trigger updating the same row.
  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({
      discount_type: discountType,
      discount_value: discountValue,
      discount_reason: discountReason || null,
      discount_applied_by: discountAppliedBy,
    })
    .eq('id', orderId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  // Fetch the updated order after the trigger has recalculated totals
  const { data: updatedOrder, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('id, subtotal, tax, total, discount_type, discount_value, discount_amount')
    .eq('id', orderId)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  // Audit-log every non-zero discount. Best-effort: if the insert fails
  // (table missing, RLS hiccup) the discount itself is already applied —
  // log to console and Sentry but never roll back the discount.
  if (discountType !== 'none' && subtotal > 0) {
    const fraction = discountType === 'percentage' ? discountValue / 100 : discountValue / subtotal;
    const discountAmount = Number(updatedOrder?.discount_amount ?? 0);
    try {
      await supabaseAdmin.from('financial_audit_log').insert({
        tenant_id: tenantId,
        staff_id: discountAppliedBy,
        order_id: orderId,
        action: 'discount_applied',
        details: {
          discount_type: discountType,
          discount_value: discountValue,
          discount_amount: discountAmount,
          reason: discountReason ?? null,
          fraction,
          ...(clientRequestId ? { client_request_id: clientRequestId } : {}),
        },
      });
    } catch (err) {
      // Non-fatal — surface for triage but never break the discount path.
      console.warn('[discount-service] financial_audit_log insert failed', err);
    }
  }

  return { order: updatedOrder, deduped: false };
}
