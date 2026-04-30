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

export type TenantClaimError = 'invalid_tenant' | 'tenant_claim_mismatch';

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
  const { data: tenant, error: tenantErr } = await client
    .from('tenants')
    .select('id')
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
