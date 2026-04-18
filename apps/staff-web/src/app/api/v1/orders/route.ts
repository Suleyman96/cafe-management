import { OrderSourceSchema, OrderTypeSchema } from '@gustri/database';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonError, jsonOk, jsonRateLimited } from '@/lib/api/response';
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
  customer_notes: z.string().optional().nullable(),
  internal_notes: z.string().optional().nullable(),
  delivery_address: z.string().optional().nullable(),
  delivery_phone: z.string().optional().nullable(),
  delivery_customer_name: z.string().optional().nullable(),
  delivery_customer_id: z.string().uuid().optional().nullable(),
  delivery_fee: z.number().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = rateLimit(`order-create:${ip}`, { limit: 30, windowSeconds: 60 });
    if (!success) return jsonRateLimited(resetAt);

    const staffOrError = await verifyStaff(request);
    if (staffOrError instanceof NextResponse) return staffOrError;

    const { data, error } = await validateBody(request, CreateOrderSchema);
    if (error) return error;

    const order = await createOrder(getSupabaseAdmin(), {
      orderData: data,
      tenantId: staffOrError.tenant_id,
    });

    return jsonOk({ order }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    // Plan limit errors are 403, everything else 400
    const status = message.includes('plan allows') ? 403 : 400;
    return jsonError(message, status);
  }
}
