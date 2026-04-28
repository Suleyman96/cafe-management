import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateByClientRequestId } from '@/lib/api/dedupe';

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
      // On replay the helper short-circuits and we never re-tally totals
      // here. That matters: by the time a paused refund mutation replays,
      // additional refunds may have left the available balance below the
      // replayed amount, and we don't want the original (already-applied)
      // refund to be falsely rejected.
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('id, total, tenant_id')
        .eq('id', orderId)
        .eq('tenant_id', tenantId)
        .single();

      if (orderError || !order) {
        throw new Error('Order not found');
      }

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

      const { data: refund, error: createError } = await supabaseAdmin
        .from('refunds')
        .insert({
          order_id: orderId,
          tenant_id: tenantId,
          amount,
          reason: refundData.reason,
          refund_method: refundData.refund_method,
          processed_by: refundData.processed_by,
          order_item_ids: refundData.order_item_ids || null,
          notes: refundData.notes || null,
          client_request_id: refundData.client_request_id ?? null,
        })
        .select(REFUND_SELECT)
        .single();

      if (createError) throw createError;
      return refund;
    },
  });

  return { refund: result.row, deduped: result.deduped };
}
