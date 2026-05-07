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
 * This is used by RLS policies to scope access. We also bind the tenant id
 * to the wrapper so its defense-in-depth tenant predicate (H5) takes effect
 * on subsequent reads.
 *
 * L4 — the RPC now RETURNS the resolved `tenant_id`. Pre-L4 we made a
 * second `db.tables.findByQrCode(qrToken)` call to recover it client-side,
 * but that required anon SELECT on the `qr_code` column, which leaks the
 * full QR-code list to anyone with the public anon key. The RPC runs as
 * `SECURITY DEFINER` (postgres), so it can read the column even after
 * we revoke anon's column-level SELECT in 20260507000006.
 */
export async function setTableContext(qrToken: string) {
  // Supabase client can't resolve RPC arg types — typed in Database['public']['Functions']
  const { data: tenantId, error } = await (supabase.rpc as Function)('set_table_context', {
    qr_token: qrToken,
  });
  if (error) {
    throw handleSupabaseError(error);
  }
  if (typeof tenantId === 'string' && tenantId.length > 0) {
    db.setTenantContext(tenantId);
  } else {
    // The RPC succeeded (no sentinel exception) but didn't return a
    // tenant id — that should be impossible with the current function
    // body. Surface to Sentry so we notice if a future migration
    // changes the contract; the wrapper falls back to RLS-only scoping.
    Sentry.captureMessage('set_table_context returned no tenant_id', {
      level: 'warning',
      tags: { surface: 'set_table_context.return' },
    });
  }
}
