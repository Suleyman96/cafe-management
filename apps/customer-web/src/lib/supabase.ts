import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

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

/**
 * Set table context for customer session
 * This is used by RLS policies to scope access
 */
export async function setTableContext(qrToken: string) {
  // Set session variable for RLS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).rpc('set_table_context', { qr_token: qrToken });
}
