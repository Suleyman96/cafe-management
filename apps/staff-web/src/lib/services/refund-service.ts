import type { SupabaseClient } from '@supabase/supabase-js';

interface CreateRefundParams {
  orderId: string;
  refundData: {
    amount: number;
    reason: string;
    refund_method: string;
    processed_by: string;
    order_item_ids?: string[] | null;
    notes?: string | null;
  };
  tenantId: string;
}

export async function createRefund(supabaseAdmin: SupabaseClient, params: CreateRefundParams) {
  const { orderId, refundData, tenantId } = params;

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

  // Check how much has been paid and refunded
  const { data: totalPaid } = await supabaseAdmin
    .from('order_payments')
    .select('amount')
    .eq('order_id', orderId);

  const { data: totalRefunded } = await supabaseAdmin
    .from('refunds')
    .select('amount')
    .eq('order_id', orderId);

  const paidAmount = (totalPaid || []).reduce((sum, p) => sum + Number(p.amount), 0);
  const refundedAmount = (totalRefunded || []).reduce((sum, r) => sum + Number(r.amount), 0);
  const available = paidAmount - refundedAmount;

  const amount = Number(refundData.amount);
  if (!amount || amount <= 0) {
    throw new Error('Refund amount must be greater than 0');
  }

  if (amount > available) {
    throw new Error(`Refund amount (${amount}) exceeds available amount (${available})`);
  }

  // Create the refund
  const { data: refund, error: createError } = await supabaseAdmin
    .from('refunds')
    .insert({
      order_id: orderId,
      amount,
      reason: refundData.reason,
      refund_method: refundData.refund_method,
      processed_by: refundData.processed_by,
      order_item_ids: refundData.order_item_ids || null,
      notes: refundData.notes || null,
    })
    .select(
      `
      *,
      processed_by_staff:staff!refunds_processed_by_fkey(full_name, role)
    `,
    )
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  return refund;
}
