import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { verifyCustomerSignature } from '@/lib/api/verify-customer-signature';
import { cancelCustomerOrderItem } from '@/lib/services/customer-order-service';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

// C3 — `table_id` matches the M6 pattern on the order-level cancel:
// the customer must hold both the order's id (in the path) AND the
// table's id (in the body) to cancel. An attacker who only scraped
// the item_id fails authorization.
//
// `cancel_qty` is optional — omit (or pass `null`/`0`) for a full
// cancel, pass a positive integer for partial cancel. The service
// clamps `cancel_qty >= item.quantity` to a full cancel, so callers
// don't need to clamp before submitting.
const CancelItemSchema = z.object({
  table_id: z.string().uuid(),
  cancel_qty: z.number().int().positive().max(999).optional().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('order-cancel', ip);
    if (!success) return jsonRateLimited(resetAt);

    // ADD-8: verify the BFF proxy's HMAC signature (no-op unless the secret is set).
    await verifyCustomerSignature(request);

    const { id: orderId, itemId } = await params;

    const { data, error } = await validateBody(request, CancelItemSchema);
    if (error) return error;

    const item = await cancelCustomerOrderItem(getSupabaseAdmin(), {
      orderId,
      itemId,
      tableId: data.table_id,
      cancelQty: data.cancel_qty ?? null,
    });

    return jsonOk({ item });
  } catch (err) {
    return handleRouteError(err, request);
  }
}
