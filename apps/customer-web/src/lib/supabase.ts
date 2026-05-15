import { createSupabaseWrapper, handleSupabaseError } from '@gustri/api-client';
import type { Database } from '@gustri/database';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Custom fetch wrapper that throttles Supabase REST API calls.
 * Limits to 20 requests per 10 seconds to prevent client-side abuse
 * (e.g. rapid page navigation, automated scraping via the anon key).
 */
const supabaseFetchTimestamps: number[] = [];

const throttledFetch: typeof fetch = (input, init) => {
  const now = Date.now();
  const windowMs = 10_000;
  const maxRequests = 20;

  // Remove timestamps outside the window
  while (supabaseFetchTimestamps.length > 0 && now - supabaseFetchTimestamps[0] > windowMs) {
    supabaseFetchTimestamps.shift();
  }

  if (supabaseFetchTimestamps.length >= maxRequests) {
    return Promise.reject(new Error('Too many requests. Please wait a moment.'));
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
    db.setTenantContext(tenantId);
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
