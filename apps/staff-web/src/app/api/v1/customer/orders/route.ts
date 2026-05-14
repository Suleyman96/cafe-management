import { isValidPhone } from '@gustri/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { createCustomerOrder } from '@/lib/services/customer-order-service';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

// Tenant binding is derived server-side (C1). Clients send `table_id`
// (dine_in) or `qr_token` (takeout/delivery); the service resolves the
// tenant from those and IGNORES anything the body claims about
// `tenant_id`. The discriminated union below means a takeout/delivery
// payload missing `qr_token` fails validation here, not deep in the
// service — so the unauthenticated tenant-spoofing path is a 400, not
// a misrouted insert.
//
// Length caps (H3): every customer-supplied free-text field has an
// explicit `.max()`. Without these the wrapper accepts arbitrarily long
// strings and an attacker can post a 50 MB `customer_notes` value as a
// storage / realtime-fanout DoS. Numbers below mirror the staff-side
// `OrderCreateInputSchema` in `@gustri/database/schemas/inputs` so a row
// that survives the customer route also survives staff edits.
const BaseFields = {
  source: z.string().max(50).optional(),
  customer_notes: z.string().max(2000).optional().nullable(),
  // Required (Blocker 1): a customer tapping "place order" twice on a
  // flaky connection can otherwise post duplicate kitchen tickets. The
  // customer-web wrapper stamps a fresh UUID per mutation lifecycle so
  // React Query retries reuse it.
  client_request_id: z.string().uuid(),
} as const;

const DineInSchema = z.object({
  ...BaseFields,
  order_type: z.literal('dine_in'),
  table_id: z.string().uuid(),
});

const TakeoutSchema = z.object({
  ...BaseFields,
  order_type: z.literal('takeout'),
  qr_token: z.string().min(1).max(128),
});

const DeliverySchema = z.object({
  ...BaseFields,
  order_type: z.literal('delivery'),
  qr_token: z.string().min(1).max(128),
  delivery_address: z.string().min(1).max(500),
  // Audit fix — character-set + length bounds were accepting shape-valid
  // garbage like `+()()()()` (no real digits). `isValidPhone` from
  // `@gustri/core` enforces ≥ MIN_PHONE_DIGITS real digits in addition to
  // the character set. Same helper runs client-side in
  // `apps/customer-web/src/app/delivery/page.tsx` so the bypass-the-client
  // path can't post inputs the form would have rejected.
  delivery_phone: z.string().refine(isValidPhone, 'invalid_phone_format'),
  delivery_customer_name: z.string().max(100).optional().nullable(),
  delivery_fee: z.number().min(0).optional().nullable(),
});

const CreateCustomerOrderSchema = z.discriminatedUnion('order_type', [
  DineInSchema,
  TakeoutSchema,
  DeliverySchema,
]);

export async function POST(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('order-create', ip);
    if (!success) return jsonRateLimited(resetAt);

    const { data, error } = await validateBody(request, CreateCustomerOrderSchema);
    if (error) return error;

    const { order, deduped } = await createCustomerOrder(getSupabaseAdmin(), {
      orderData: data,
    });

    return jsonOk({ order }, deduped ? 200 : 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
