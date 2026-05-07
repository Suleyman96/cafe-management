import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { cancelCustomerOrder } from '@/lib/services/customer-order-service';

export const dynamic = 'force-dynamic';

// `tenant_id` is intentionally NOT in the schema — the service derives
// it from the order row server-side. `table_id` IS required: the
// service uses it to verify the cancel is happening from the same
// table the order was placed at, raising the bar above "anyone with
// the order_id can cancel it" (M6).
//
// `reason` is short free text; cap matches the
// `orders.internal_notes_length_check` from PR2.
const CancelOrderSchema = z.object({
  table_id: z.string().uuid(),
  reason: z.string().max(500).optional().nullable(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('order-cancel', ip);
    if (!success) return jsonRateLimited(resetAt);

    const { id: orderId } = await params;

    const { data, error } = await validateBody(request, CancelOrderSchema);
    if (error) return error;

    const order = await cancelCustomerOrder(getSupabaseAdmin(), {
      orderId,
      tableId: data.table_id,
      reason: data.reason ?? null,
    });

    return jsonOk({ order });
  } catch (err) {
    return handleRouteError(err);
  }
}
