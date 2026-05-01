import { createSupabaseWrapper, handleSupabaseError } from '@gustri/api-client';
import type { Database } from '@gustri/database';
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
 * Set table context for customer session
 * This is used by RLS policies to scope access. We also resolve the tenant
 * id from the table row so the wrapper can apply its defense-in-depth
 * tenant predicate (H5) on subsequent reads.
 */
export async function setTableContext(qrToken: string) {
  // Set session variable for RLS
  // Supabase client can't resolve RPC arg types — typed in Database['public']['Functions']
  const { error } = await (supabase.rpc as Function)('set_table_context', { qr_token: qrToken });
  if (error) {
    throw handleSupabaseError(error);
  }
  // Look up the table row by qr_code so we can bind its tenant_id to the
  // wrapper. Anon RLS allows this read.
  try {
    const table = await db.tables.findByQrCode(qrToken);
    db.setTenantContext(table.tenant_id);
  } catch {
    // If the lookup fails the wrapper stays at tenantId=null and
    // continues to rely on RLS alone — same as before.
  }
}
