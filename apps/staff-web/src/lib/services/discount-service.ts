import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side discount validation and application.
 * Replaces client-side validation in discount-modal.tsx.
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
  // Don't use .select().single() here to avoid PostgREST "Cannot coerce" errors
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
}
