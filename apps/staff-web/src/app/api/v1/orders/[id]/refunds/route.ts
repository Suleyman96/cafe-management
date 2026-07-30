import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';
import { createRefund } from '@/lib/services/refund-service';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

const CreateRefundSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1),
  refund_method: z.enum(['cash', 'card', 'digital']),
  // Optional + ignored: the server stamps the actor from the verified admin
  // JWT (see below). Accepted only so older clients don't 400; never trusted.
  processed_by: z.string().uuid().optional(),
  order_item_ids: z.array(z.string().uuid()).optional().nullable(),
  notes: z.string().optional().nullable(),
  // Required (Blocker 1): refunds must dedupe on retry. The trigger-based
  // balance check already serializes correctly, but without a key a
  // dropped-response replay would issue a second refund row.
  client_request_id: z.string().uuid(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await params;

    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('payment', ip);
    if (!success) return jsonRateLimited(resetAt);

    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    const { data, error } = await validateBody(request, CreateRefundSchema);
    if (error) return error;

    // Audit integrity: stamp the actor from the verified admin JWT, never the
    // body. `processed_by` is written to financial_audit_log — a spoofable id
    // there undermines exactly the records used to resolve payment disputes.
    // Spread-injected (not mutated) so the type is guaranteed non-optional.
    const { refund, deduped } = await createRefund(getSupabaseAdmin(), {
      orderId,
      refundData: { ...data, processed_by: adminOrError.id },
      tenantId: adminOrError.tenant_id,
    });

    return jsonOk({ refund }, deduped ? 200 : 201);
  } catch (err) {
    return handleRouteError(err, request);
  }
}
