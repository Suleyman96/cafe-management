import { OrderTypeSchema } from '@gustri/database';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { createCustomerOrder } from '@/lib/services/customer-order-service';

export const dynamic = 'force-dynamic';

const CreateCustomerOrderSchema = z.object({
  table_id: z.string().uuid().optional().nullable(),
  tenant_id: z.string().uuid(),
  order_type: OrderTypeSchema,
  source: z.string().optional(),
  customer_notes: z.string().optional().nullable(),
  delivery_address: z.string().optional().nullable(),
  delivery_phone: z.string().optional().nullable(),
  delivery_customer_name: z.string().optional().nullable(),
  delivery_fee: z.number().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('order-create', ip);
    if (!success) return jsonRateLimited(resetAt);

    const { data, error } = await validateBody(request, CreateCustomerOrderSchema);
    if (error) return error;

    const order = await createCustomerOrder(getSupabaseAdmin(), {
      orderData: data,
    });

    return jsonOk({ order }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
