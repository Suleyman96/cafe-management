import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { resolveCustomerQrToken } from '@/lib/services/customer-qr-token-service';

export const dynamic = 'force-dynamic';

// SSR-multi-tenant fix (deferred item from plans/18). The
// customer-web `/delivery/menu` page used to fetch categories and menu
// items via the anon Supabase client with no tenant context bound; in
// multi-tenant prod that produced an SSR HTML payload that briefly
// contained mixed-tenant items before the client guard redirected.
//
// This route is the trust boundary that closes the gap: the client
// posts the bearer `qr_token` (already captured on the
// `/delivery?token=…` landing page), the service validates it against
// `qr_tokens` + the tenant's plan flag, and we hand back the resolved
// `tenant_id`. The client then binds it via
// `db.setTenantContext(tenant_id)` so subsequent wrapper reads pick up
// the existing `applyTenantScope` predicate.
const ResolveQrTokenSchema = z.object({
  // Length cap mirrors `customer-orders` schema — qr_tokens.token is a
  // 32+ random-byte string in practice, but we accept anything up to
  // 128 to keep room for future format changes.
  qr_token: z.string().min(1).max(128),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    const { success, resetAt } = await rateLimit('customer-qr-token', ip);
    if (!success) return jsonRateLimited(resetAt);

    const { data, error } = await validateBody(request, ResolveQrTokenSchema);
    if (error) return error;

    const result = await resolveCustomerQrToken(getSupabaseAdmin(), data);

    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
