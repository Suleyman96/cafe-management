import { createSupabaseWrapper } from '@gustri/api-client';
import type { Database } from '@gustri/database';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Customers don't need persistent auth
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
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
