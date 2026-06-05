import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { verifyCustomerSignature } from '@/lib/api/verify-customer-signature';
import { createCustomerFeedback } from '@/lib/services/customer-engagement-service';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

// H1 length cap: `message` matches the
// `customer_feedback_message_length_check` constraint added in PR 2.
// Tenant is server-derived from `table_id`. Required `client_request_id`
// (S4 / migration 20260517000001) so a rage-tap or network retry
// dedupes on the (tenant_id, client_request_id) partial unique index
// instead of stamping a second complaint row in the staff queue.
const CreateFeedbackSchema = z.object({
  table_id: z.string().uuid(),
  order_id: z.string().uuid().optional().nullable(),
  feedback_type: z.enum(['complaint', 'praise']),
  message: z.string().min(1).max(1000),
  client_request_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('feedback', ip);
    if (!success) return jsonRateLimited(resetAt);

    // ADD-8: verify the BFF proxy's HMAC signature (no-op unless the secret is set).
    await verifyCustomerSignature(request);

    const { data, error } = await validateBody(request, CreateFeedbackSchema);
    if (error) return error;

    const { row, deduped } = await createCustomerFeedback(getSupabaseAdmin(), data);

    return jsonOk({ feedback: row }, deduped ? 200 : 201);
  } catch (err) {
    return handleRouteError(err, request);
  }
}
