import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { addCustomerOrderItems } from '@/lib/services/customer-order-service';

export const dynamic = 'force-dynamic';

const AddItemsSchema = z.object({
  items: z
    .array(
      z.object({
        menu_item_id: z.string().uuid(),
        item_name: z.string().min(1),
        item_price: z.number().min(0),
        quantity: z.number().int().positive(),
        notes: z.string().optional().nullable(),
        tenant_id: z.string().uuid(),
      }),
    )
    .min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await params;

    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('order-create', ip);
    if (!success) return jsonRateLimited(resetAt);

    const { data, error } = await validateBody(request, AddItemsSchema);
    if (error) return error;

    const items = await addCustomerOrderItems(getSupabaseAdmin(), {
      orderId,
      items: data.items,
    });

    return jsonOk({ items }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
