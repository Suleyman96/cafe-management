import { PaymentMethodSchema, PaymentTypeSchema } from '@gustri/database';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { verifyStaff } from '@/lib/api/verify-staff';
import { createPayment } from '@/lib/services/payment-service';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

const CreatePaymentSchema = z.object({
  amount: z.number().positive(),
  payment_method: PaymentMethodSchema,
  payment_type: PaymentTypeSchema,
  // Optional + ignored: the server stamps the actor from the verified JWT
  // (see below). Accepted here only so older clients that still send it don't
  // 400 — the value is never trusted.
  received_by: z.string().uuid().optional(),
  tip_amount: z.number().min(0).optional().default(0),
  notes: z.string().optional().nullable(),
  // Must be `order_item_ids` (the DB column + what the web/mobile clients send).
  // It was `item_ids`, so Zod stripped the real field, the service inserted NULL,
  // and the validate_items_payment trigger rejected every specific_items payment
  // with "order_item_ids must be provided". (Masked when tax > 0, since the modal
  // falls back to partial_amount then.)
  order_item_ids: z.array(z.string().uuid()).optional().nullable(),
  // Required (Blocker 1): payment routes are the highest-risk replay path.
  // A missing key forces a 400 instead of a duplicate charge.
  client_request_id: z.string().uuid(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await params;

    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('payment', ip);
    if (!success) return jsonRateLimited(resetAt);

    const staffOrError = await verifyStaff(request);
    if (staffOrError instanceof NextResponse) return staffOrError;

    const { data, error } = await validateBody(request, CreatePaymentSchema);
    if (error) return error;

    // Audit integrity: the actor is the verified caller, never a body-supplied
    // id. `received_by` lands on the payment/financial trail — trusting the body
    // would let any authenticated staff stamp a payment as someone else.
    data.received_by = staffOrError.id;

    const { payment, deduped } = await createPayment(getSupabaseAdmin(), {
      orderId,
      paymentData: data,
      tenantId: staffOrError.tenant_id,
    });

    return jsonOk({ payment }, deduped ? 200 : 201);
  } catch (err) {
    return handleRouteError(err, request);
  }
}
