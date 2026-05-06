import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { createCustomerFeedback } from '@/lib/services/customer-engagement-service';

export const dynamic = 'force-dynamic';

// H1 length cap: `message` matches the
// `customer_feedback_message_length_check` constraint added in PR 2.
// Tenant is server-derived from `table_id`. No `client_request_id`
// here — see comment in customer-engagement-service.ts on why feedback
// dedupe is deferred (column doesn't exist; rate limiter handles spam).
const CreateFeedbackSchema = z.object({
  table_id: z.string().uuid(),
  order_id: z.string().uuid().optional().nullable(),
  feedback_type: z.enum(['complaint', 'praise']),
  message: z.string().min(1).max(1000),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('feedback', ip);
    if (!success) return jsonRateLimited(resetAt);

    const { data, error } = await validateBody(request, CreateFeedbackSchema);
    if (error) return error;

    const row = await createCustomerFeedback(getSupabaseAdmin(), data);

    return jsonOk({ feedback: row }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
