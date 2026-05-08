import { handleSupabaseError } from '@gustri/api-client';
import { ConflictError } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateByClientRequestId } from '@/lib/api/dedupe';

/**
 * Server-side payment creation with balance validation.
 * Ensures overpayment cannot occur via client-side manipulation.
 */

interface CreatePaymentParams {
  orderId: string;
  paymentData: Record<string, unknown> & { client_request_id?: string };
  tenantId: string;
}

const PAYMENT_SELECT = `
  *,
  received_by_staff:staff!order_payments_received_by_fkey(full_name, role)
`;

export async function createPayment(supabaseAdmin: SupabaseClient, params: CreatePaymentParams) {
  const { orderId, paymentData, tenantId } = params;

  const result = await findOrCreateByClientRequestId<Record<string, unknown>>(supabaseAdmin, {
    table: 'order_payments',
    tenantId,
    clientRequestId: paymentData.client_request_id,
    selectShape: PAYMENT_SELECT,
    create: async () => {
      // On replay the helper short-circuits before this body runs, so the
      // balance check below sees the world as it was on the first attempt.
      // A late replay against an order that's since been over-allocated
      // therefore won't be falsely rejected.
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('id, total, tenant_id')
        .eq('id', orderId)
        .eq('tenant_id', tenantId)
        .single();

      if (orderError || !order) {
        throw new Error('Order not found');
      }

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
        // Throw the same sentinel + status (409) the trigger raises on the
        // race-loser path so client error handling is uniform regardless of
        // which check fires. Pre-Blocker-5 this was a prose `Error` that
        // `handleRouteError` mapped to 422 + English text, defeating both
        // i18n and the client's 409-driven refetch.
        throw new ConflictError('payment_exceeds_remaining');
      }

      const { data: payment, error: createError } = await supabaseAdmin
        .from('order_payments')
        .insert({
          ...paymentData,
          order_id: orderId,
          tenant_id: tenantId,
          amount,
        })
        .select(PAYMENT_SELECT)
        .single();

      // The validate_payment_amount trigger is the authority. The pre-check
      // above gives us a friendlier client error in the common case, but the
      // trigger is what survives a concurrent insert that wins the race.
      // Map its check_violation back to a typed AppError so handleRouteError
      // returns a proper 409 with the sentinel code instead of a 500.
      if (createError) throw handleSupabaseError(createError);
      return payment;
    },
  });

  return { payment: result.row, deduped: result.deduped };
}
