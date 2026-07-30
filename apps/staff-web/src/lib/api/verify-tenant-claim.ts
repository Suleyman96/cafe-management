import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './verify-admin';

/**
 * Cross-check the JWT `tenant_id` claim against the actual `staff` row before
 * trusting it. Without this check, a token with a swapped `tenant_id` would
 * route a real staff member into another tenant's data — RLS would still
 * enforce per-row scoping, but server-side endpoints (which use the service
 * role) would happily read/write under the wrong tenant.
 *
 * Cached in-process for 30s with a tiny TTL map keyed by
 * `(staff_id, tenant_id)`. Token verification already happened upstream
 * (`auth.getUser`), so the cache trades correctness against a 30s stale
 * window — short enough that a tenant transfer (very rare) takes effect on
 * the next request without us needing a cache-bust hook.
 *
 * Returns `null` on success, or a string error code (`'invalid_tenant'` or
 * `'tenant_claim_mismatch'`) the caller maps to a 403 response. The Sentry
 * warning is fired here so every potential exploit attempt surfaces in
 * triage even if the caller forgets to log.
 */

const TTL_MS = 30_000;

interface CacheEntry {
  expiresAt: number;
  ok: boolean;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(staffId: string, tenantId: string) {
  return `${staffId}:${tenantId}`;
}

export type TenantClaimError = 'invalid_tenant' | 'tenant_claim_mismatch' | 'tenant_inactive';

export async function verifyTenantClaim(
  staffId: string,
  tenantId: string,
  client: SupabaseClient = getSupabaseAdmin(),
): Promise<TenantClaimError | null> {
  const key = cacheKey(staffId, tenantId);
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) {
    return hit.ok ? null : 'tenant_claim_mismatch';
  }

  // Tenant existence check first — invalid_tenant is a different error from
  // mismatch, useful both for logs and for the eventual SOC alert rule.
  // `is_active` is fetched in the same SELECT (no extra round-trip) to gate the
  // service-role /api/v1/* write path for closed tenants — RLS already blocks
  // direct reads via current_tenant_id(), but these endpoints bypass RLS, so a
  // closed account could otherwise still move money (refunds/discounts) here.
  const { data: tenant, error: tenantErr } = await client
    .from('tenants')
    .select('id, is_active')
    .eq('id', tenantId)
    .maybeSingle();
  if (tenantErr || !tenant) {
    cache.set(key, { expiresAt: now + TTL_MS, ok: false });
    Sentry.captureMessage('tenant_claim_mismatch', {
      level: 'warning',
      extra: { reason: 'invalid_tenant', staffId, tenantId },
    });
    return 'invalid_tenant';
  }
  if (tenant.is_active === false) {
    // Soft-closed tenant. Cache as not-ok so repeat calls stay blocked within
    // the 30s window (same trust window as the rest of the auth cache). Undo is
    // support-only — a deactivated owner must not be able to reactivate through
    // an endpoint that this very gate would let them reach.
    cache.set(key, { expiresAt: now + TTL_MS, ok: false });
    Sentry.captureMessage('tenant_inactive', {
      level: 'warning',
      extra: { reason: 'tenant_inactive', staffId, tenantId },
    });
    return 'tenant_inactive';
  }

  const { data: staff, error: staffErr } = await client
    .from('staff')
    .select('id, tenant_id')
    .eq('id', staffId)
    .maybeSingle();
  if (staffErr || !staff || staff.tenant_id !== tenantId) {
    cache.set(key, { expiresAt: now + TTL_MS, ok: false });
    Sentry.captureMessage('tenant_claim_mismatch', {
      level: 'warning',
      extra: {
        reason: 'staff_mismatch',
        staffId,
        claimedTenantId: tenantId,
        actualTenantId: staff?.tenant_id,
      },
    });
    return 'tenant_claim_mismatch';
  }

  cache.set(key, { expiresAt: now + TTL_MS, ok: true });
  return null;
}

// Test-only escape hatch.
export function __resetTenantClaimCache(): void {
  cache.clear();
}
