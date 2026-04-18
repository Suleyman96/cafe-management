import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side payment creation with balance validation.
 * Ensures overpayment cannot occur via client-side manipulation.
 */

interface CreatePaymentParams {
  orderId: string;
  paymentData: Record<string, unknown>;
  tenantId: string;
}

export async function createPayment(supabaseAdmin: SupabaseClient, params: CreatePaymentParams) {
  const { orderId, paymentData, tenantId } = params;

  // Verify the order belongs to this tenant
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, total, tenant_id')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single();

  if (orderError || !order) {
    throw new Error('Order not found');
  }

  // Check remaining balance via RPC
  const { data: remaining, error: balanceError } = await supabaseAdmin.rpc(
    'get_order_remaining_balance',
    { order_uuid: orderId },
  );

  if (balanceError) {
    throw new Error('Failed to check order balance');
  }

  const amount = Number(paymentData.amount);
  if (!amount || amount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }

  if (amount > Number(remaining)) {
    throw new Error(`Payment amount (${amount}) exceeds remaining balance (${remaining})`);
  }

  // Create the payment
  const { data: payment, error: createError } = await supabaseAdmin
    .from('order_payments')
    .insert({
      ...paymentData,
      order_id: orderId,
      amount,
    })
    .select(
      `
      *,
      received_by_staff:staff!order_payments_received_by_fkey(full_name, role)
    `,
    )
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  return payment;
}
