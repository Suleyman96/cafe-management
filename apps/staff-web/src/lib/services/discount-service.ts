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
 */

interface ApplyDiscountParams {
  orderId: string;
  discountType: 'none' | 'percentage' | 'fixed';
  discountValue: number;
  discountReason?: string | null;
  discountAppliedBy: string;
  tenantId: string;
}

export async function applyDiscount(supabaseAdmin: SupabaseClient, params: ApplyDiscountParams) {
  const { orderId, discountType, discountValue, discountReason, discountAppliedBy, tenantId } =
    params;

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

  // Validate discount
  if (discountType === 'none') {
    // Removing discount — no further validation needed
  } else if (discountType === 'percentage') {
    if (discountValue <= 0 || discountValue > 100) {
      throw new Error('Percentage discount must be between 0 and 100');
    }
  } else if (discountType === 'fixed') {
    if (discountValue <= 0) {
      throw new Error('Fixed discount must be greater than 0');
    }
    if (discountValue > Number(order.subtotal)) {
      throw new Error('Fixed discount cannot exceed order subtotal');
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
    .select('id, subtotal, tax, total, discount_type, discount_value')
    .eq('id', orderId)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  return updatedOrder;
}
