import {
  AuthorizationError,
  DISCOUNT_AUDIT_THRESHOLD,
  getDiscountCapForRole,
  ValidationError,
} from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side discount validation and application.
 * Replaces client-side validation in discount-modal.tsx.
 *
 * Idempotency: this is an UPDATE that writes absolute discount values
 * (`discount_type`, `discount_value`) — not deltas — and the
 * `recalculate_on_discount_change` trigger derives totals from those
 * absolute values. A paused-then-replayed mutation produces the same
 * final order state, so no `client_request_id` is required here.
 * Do NOT switch to delta math without also adding a dedupe key.
 *
 * Role cap enforcement: a waiter applying a 99% fixed discount is
 * economically a refund without the admin guard refunds require. The
 * cap from `DISCOUNT_CAPS_BY_ROLE` (in `@gustri/core/constants`) bounds
 * the effective fraction (`discount_value / subtotal` for fixed,
 * `discount_value / 100` for percentage) at apply time. Discounts above
 * `DISCOUNT_AUDIT_THRESHOLD` always write a `financial_audit_log` row
 * regardless of role so triage has a paper trail.
 */

interface ApplyDiscountParams {
  orderId: string;
  discountType: 'none' | 'percentage' | 'fixed';
  discountValue: number;
  discountReason?: string | null;
  discountAppliedBy: string;
  tenantId: string;
  /** Caller's role — required to enforce per-role caps. */
  callerRole: string;
}

export async function applyDiscount(supabaseAdmin: SupabaseClient, params: ApplyDiscountParams) {
  const { orderId, discountType, discountReason, discountAppliedBy, tenantId, callerRole } = params;
  let { discountValue } = params;

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
  if (discountType === 'none') {
    discountValue = 0;
  } else if (discountType === 'percentage') {
    if (discountValue <= 0 || discountValue > 100) {
      throw new Error('Percentage discount must be between 0 and 100');
    }
  } else if (discountType === 'fixed') {
    if (discountValue <= 0) {
      throw new Error('Fixed discount must be greater than 0');
    }
    if (discountValue > subtotal) {
      throw new Error('Fixed discount cannot exceed order subtotal');
    }
  }

  // Per-role cap. `none` is always allowed (clearing a discount can't be a
  // privilege escalation). For percentage we compare directly; for fixed we
  // derive the effective fraction against the subtotal.
  if (discountType !== 'none') {
    const requestedFraction =
      discountType === 'percentage'
        ? discountValue / 100
        : subtotal > 0
          ? discountValue / subtotal
          : 1;
    const cap = getDiscountCapForRole(callerRole);
    if (requestedFraction > cap + 1e-9) {
      throw new AuthorizationError(
        `Discount cap exceeded for role "${callerRole}" (cap ${(cap * 100).toFixed(0)}%, requested ${(requestedFraction * 100).toFixed(1)}%)`,
      );
    }

    // Above the audit threshold a financial_audit_log row is written below;
    // require a non-trivial reason so the audit trail is forensically usable.
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

  // Audit-log any discount above the threshold. This is best-effort: if the
  // insert fails (table missing, RLS hiccup) the discount itself is already
  // applied — log to console and Sentry but never roll back the discount.
  // Calling out the cap-bypass case (cap=1.0 for admin/owner) explicitly: a
  // 100%-cap role can apply any discount, but a 100% comp still gets a
  // financial_audit_log row.
  if (discountType !== 'none' && subtotal > 0) {
    const fraction = discountType === 'percentage' ? discountValue / 100 : discountValue / subtotal;
    if (fraction >= DISCOUNT_AUDIT_THRESHOLD) {
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
            role: callerRole,
            reason: discountReason ?? null,
            fraction,
          },
        });
      } catch (err) {
        // Non-fatal — surface for triage but never break the discount path.
        console.warn('[discount-service] financial_audit_log insert failed', err);
      }
    }
  }

  return updatedOrder;
}
