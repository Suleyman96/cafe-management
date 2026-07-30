import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { getRateLimitIdentifier, rateLimit } from '@/lib/api/rate-limit';
import { jsonOk, jsonRateLimited } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validate';
import { getSupabaseAdmin, verifyAdmin } from '@/lib/api/verify-admin';

export const dynamic = 'force-dynamic';
export const preferredRegion = ['sin1'];

const DeactivateSchema = z.object({
  // Type-to-confirm literal (English-only, matches the UI phrase). Guards
  // against an accidental or automated POST closing a live account. See the
  // destructive-action conventions in CLAUDE.md.
  confirmation: z.literal('CLOSE'),
  reason: z.string().max(500).optional().nullable(),
});

/**
 * Close (soft-delete) the caller's own tenant. Reversible support-side; there
 * is intentionally NO self-serve reactivation endpoint, because deactivation
 * fails the tenant closed at every access path — including this route's own
 * auth gate (`verifyTenantClaim` → `tenant_inactive`), so a reactivate endpoint
 * would be unreachable by the very owner who needs it. Reopening is a support
 * action (flip `tenants.is_active` back via service role) within the grace
 * period, before the eventual hard purge.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getRateLimitIdentifier(request);
    // Reuse the org-management ('staff') bucket — account closure is a rare
    // admin/org action, not a hot path worth its own limiter.
    const { success, resetAt } = await rateLimit('staff', ip);
    if (!success) return jsonRateLimited(resetAt);

    const adminOrError = await verifyAdmin(request);
    if (adminOrError instanceof NextResponse) return adminOrError;

    // Account closure is owner-only — the single most consequential org action.
    // verifyAdmin admits `admin` too; narrow to `owner` here.
    if (adminOrError.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden: owner access required' }, { status: 403 });
    }

    const { data, error } = await validateBody(request, DeactivateSchema);
    if (error) return error;

    // Service role + filter on the verified tenant_id: an owner can only close
    // their OWN tenant, never another via a swapped body/claim.
    const supabase = getSupabaseAdmin();
    const { error: updateErr } = await supabase
      .from('tenants')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivated_by: adminOrError.id,
        deactivation_reason: data.reason ?? null,
      })
      .eq('id', adminOrError.tenant_id);

    if (updateErr) {
      throw new Error(`tenant-deactivate: update failed (${updateErr.message})`);
    }

    return jsonOk({ status: 'deactivated', tenant_id: adminOrError.tenant_id });
  } catch (err) {
    return handleRouteError(err, request);
  }
}
