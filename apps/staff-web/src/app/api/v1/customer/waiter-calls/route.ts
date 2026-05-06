import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { createCustomerWaiterCall } from '@/lib/services/customer-engagement-service';

export const dynamic = 'force-dynamic';

// H1 length caps: every customer-typed string is bounded so a hostile
// payload can't inflate into a multi-MB realtime fanout to staff
// devices. Numbers match the schema (`waiter_calls.reason` is
// varchar(50), `notes` is text capped at 500 by the
// `waiter_calls_notes_length_check` constraint added in PR 2).
//
// `tenant_id` is intentionally NOT in the schema. The service resolves
// it from `table_id` server-side; an attacker-supplied tenant in the
// body has nowhere to go.
const CreateWaiterCallSchema = z.object({
  table_id: z.string().uuid(),
  call_type: z.enum(['assistance', 'bill', 'complaint', 'question', 'emergency']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  reason: z.string().max(50).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  // Required (Blocker 1 / migration 20260428000002): a flaky-network
  // retry must dedupe on the (tenant_id, client_request_id) partial
  // unique index instead of stamping a second pending row in the
  // staff dashboard.
  client_request_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('waiter-call', ip);
    if (!success) return jsonRateLimited(resetAt);

    const { data, error } = await validateBody(request, CreateWaiterCallSchema);
    if (error) return error;

    const { row, deduped } = await createCustomerWaiterCall(getSupabaseAdmin(), data);

    return jsonOk({ waiter_call: row }, deduped ? 200 : 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
