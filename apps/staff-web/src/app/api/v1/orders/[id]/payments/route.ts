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
  received_by: z.string().uuid(),
  tip_amount: z.number().min(0).optional().default(0),
  notes: z.string().optional().nullable(),
  item_ids: z.array(z.string().uuid()).optional().nullable(),
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

    const { payment, deduped } = await createPayment(getSupabaseAdmin(), {
      orderId,
      paymentData: data,
      tenantId: staffOrError.tenant_id,
    });

    return jsonOk({ payment }, deduped ? 200 : 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
