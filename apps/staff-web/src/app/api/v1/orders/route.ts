import { OrderSourceSchema, OrderTypeSchema } from '@gustri/database';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { verifyStaff } from '@/lib/api/verify-staff';
import { createOrder } from '@/lib/services/order-service';

export const dynamic = 'force-dynamic';

const CreateOrderSchema = z.object({
  table_id: z.string().uuid().optional().nullable(),
  order_type: OrderTypeSchema,
  order_source: OrderSourceSchema.optional(),
  assigned_waiter_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().optional().nullable(),
  customer_phone: z.string().optional().nullable(),
  customer_notes: z.string().optional().nullable(),
  internal_notes: z.string().optional().nullable(),
  delivery_address: z.string().optional().nullable(),
  delivery_notes: z.string().optional().nullable(),
  delivery_fee: z.number().optional().nullable(),
  delivery_customer_id: z.string().uuid().optional().nullable(),
  subtotal: z.number().optional().nullable(),
  tax: z.number().optional().nullable(),
  total: z.number().optional().nullable(),
  status: z.string().optional(),
  client_request_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('order-create', ip);
    if (!success) return jsonRateLimited(resetAt);

    const staffOrError = await verifyStaff(request);
    if (staffOrError instanceof NextResponse) return staffOrError;

    const { data, error } = await validateBody(request, CreateOrderSchema);
    if (error) return error;

    const { order, deduped } = await createOrder(getSupabaseAdmin(), {
      orderData: data,
      tenantId: staffOrError.tenant_id,
    });

    return jsonOk({ order }, deduped ? 200 : 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
