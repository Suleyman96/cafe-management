import { createSupabaseWrapper } from '@gustri/api-client';
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

// Wrapped client for type-safe operations
export const db = createSupabaseWrapper(supabase);

/**
 * Set table context for customer session
 * This is used by RLS policies to scope access
 */
export async function setTableContext(qrToken: string) {
  // Set session variable for RLS
  // Supabase client can't resolve RPC arg types — typed in Database['public']['Functions']
  await (supabase.rpc as Function)('set_table_context', { qr_token: qrToken });
}
