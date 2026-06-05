import { createSupabaseWrapper, handleSupabaseError } from '@gustri/api-client';
import { RateLimitError } from '@gustri/core';
import type { Database } from '@gustri/database/types';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Custom fetch wrapper that throttles Supabase REST API calls.
 *
 * Limits to 40 requests per 10 seconds to prevent client-side abuse
 * (e.g. rapid page navigation, automated scraping via the anon key).
 *
 * P2 — budget bumped from 20 → 40. The pre-fix budget tripped on a
 * legitimate first menu load (6–10 requests for tables/settings/
 * categories/menu items) once a retry happened on a flaky network.
 * Throws `RateLimitError` (from `@gustri/core`) instead of a bare
 * `new Error(...)` so the mutation cache `onError` can localize via
 * the existing sentinel pipeline instead of showing a cryptic English
 * toast. Drops a Sentry breadcrumb on every trip so we have visibility
 * into how often the cap is hit in production.
 */
const supabaseFetchTimestamps: number[] = [];

const throttledFetch: typeof fetch = (input, init) => {
  const now = Date.now();
  const windowMs = 10_000;
  const maxRequests = 40;

  // Remove timestamps outside the window
  while (supabaseFetchTimestamps.length > 0 && now - supabaseFetchTimestamps[0] > windowMs) {
    supabaseFetchTimestamps.shift();
  }

  if (supabaseFetchTimestamps.length >= maxRequests) {
    Sentry.addBreadcrumb({
      category: 'supabase-throttle',
      level: 'warning',
      message: 'client-side throttle tripped',
      data: { windowMs, maxRequests, inWindow: supabaseFetchTimestamps.length },
    });
    return Promise.reject(new RateLimitError());
  }

  supabaseFetchTimestamps.push(now);
  return fetch(input, init);
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Customers don't need persistent auth
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    fetch: throttledFetch,
  },
});

// Wrapped client for type-safe operations.
// `tenantId` stays null for anon customer-web sessions — RLS scopes via the
// QR session set by `set_table_context()`. The wrapper's read methods that
// run before context binds (menu browse, category list, etc.) are marked
// `allowNull: true` so they don't emit Sentry warnings on every page load.
// Sentry shim omitted intentionally for the same reason.
export const db = createSupabaseWrapper(supabase);

/**
 * Set table context for customer session.
 *
 * Binds the wrapper's defense-in-depth tenant predicate (H5) for
 * subsequent reads AND returns the tenant's plan in the same call.
 *
 * Why one call instead of two: the previous design called
 * `set_table_context` then `get_tenant_plan_from_context` separately.
 * `set_table_context` set session vars with `set_config(..., true)`
 * (transaction-local); PostgREST commits each RPC in its own
 * transaction; so the second call ran with the session var already
 * gone. The plan lookup matched no rows and silently returned NULL,
 * which the UI rendered as an empty 48px div — paying tenants saw no
 * "Browse Menu" CTA. Migration `20260515000003` folded the plan
 * lookup into `set_table_context` itself, so it's done in the same
 * transaction as the session-var binding.
 *
 * The QR-code lookup runs as `SECURITY DEFINER` so it can read
 * `tables.qr_code` (revoked from anon by `20260507000006`) and
 * `tenants.plan` (also anon-restricted).
 *
 * Returns the plan string (`'free' | 'standard' | 'pro' | 'business'`)
 * so the caller can drive the QR-ordering UI gate without a second
 * server round-trip. Returns `null` if the RPC succeeded but no plan
 * value came back (Sentry-reported — would indicate a contract
 * change in a future migration).
 */
export async function setTableContext(qrToken: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('set_table_context', {
    qr_token: qrToken,
  });
  if (error) {
    throw handleSupabaseError(error);
  }

  // The RPC returns jsonb `{ tenant_id: <uuid>, plan: <text> }`. The
  // generated `Json` type isn't shape-aware, so narrow at runtime.
  const payload = data as { tenant_id?: unknown; plan?: unknown } | null;
  const tenantId = typeof payload?.tenant_id === 'string' ? payload.tenant_id : null;
  const plan = typeof payload?.plan === 'string' ? payload.plan : null;

  if (tenantId) {
    bindCustomerTenantContext(tenantId, 'set-table-context');
  } else {
    // Impossible with the current function body. Surface to Sentry so
    // we notice if a future migration changes the contract; the
    // wrapper falls back to RLS-only scoping.
    Sentry.captureMessage('set_table_context returned no tenant_id', {
      level: 'warning',
      tags: { surface: 'set_table_context.return' },
    });
  }

  return plan;
}

/**
 * S4 — single audited entry point for `db.setTenantContext(...)` in
 * customer-web. The wrapper is a process-singleton; with multiple
 * surfaces (table layout, delivery context hook, `setTableContext`) all
 * mutating it, a stale-bind racing a fresh-route read is hard to
 * diagnose after the fact. Every bind drops a Sentry breadcrumb with
 * the prior + next tenant + the surface that issued the call, so a
 * mis-routed query later in the session leaves a trail.
 *
 * Idempotent: a bind that doesn't change the tenant is a breadcrumb-free
 * no-op so we don't drown Sentry in render-loop noise.
 *
 * Stronger mitigation (binding tenant into the React Query queryKey)
 * lives in Phase 1 C6 — once that lands, an in-flight read against a
 * stale tenant naturally keys under the old tenant and doesn't leak
 * into the new tenant's cache. This helper is the bridge.
 */
export function bindCustomerTenantContext(
  tenantId: string | null,
  surface:
    | 'table-layout'
    | 'table-layout-unmount'
    | 'delivery-context'
    | 'set-table-context'
    | 'route-reset',
): void {
  const prior = db.getTenantId();
  if (prior === tenantId) return;
  db.setTenantContext(tenantId);
  Sentry.addBreadcrumb({
    category: 'tenant-context',
    level: 'info',
    message: 'bindCustomerTenantContext',
    data: { surface, prior, next: tenantId },
  });
}
