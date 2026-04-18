import { PaymentMethodSchema, PaymentTypeSchema } from '@gustri/database';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonError, jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { verifyStaff } from '@/lib/api/verify-staff';
import { createPayment } from '@/lib/services/payment-service';

export const dynamic = 'force-dynamic';

const CreatePaymentSchema = z.object({
  amount: z.number().positive(),
  payment_method: PaymentMethodSchema,
  payment_type: PaymentTypeSchema,
  received_by: z.string().uuid(),
  tip_amount: z.number().min(0).optional().default(0),
  notes: z.string().optional().nullable(),
  item_ids: z.array(z.string().uuid()).optional().nullable(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await params;

    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = rateLimit(`payment:${ip}`, { limit: 20, windowSeconds: 60 });
    if (!success) return jsonRateLimited(resetAt);

    const staffOrError = await verifyStaff(request);
    if (staffOrError instanceof NextResponse) return staffOrError;

    const { data, error } = await validateBody(request, CreatePaymentSchema);
    if (error) return error;

    const payment = await createPayment(getSupabaseAdmin(), {
      orderId,
      paymentData: data,
      tenantId: staffOrError.tenant_id,
    });

    return jsonOk({ payment }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.includes('exceeds remaining') ? 422 : 400;
    return jsonError(message, status);
  }
}
