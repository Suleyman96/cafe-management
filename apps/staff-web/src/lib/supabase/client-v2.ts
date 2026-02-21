/**
 * Properly Typed Supabase Client
 * This solves the type inference issues without using 'as any'
 */

import type { Database } from '@cafe-idare/database';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create a properly typed client
export const supabaseV2 = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Type helper for insert operations
export function createInsertData<T extends keyof Database['public']['Tables']>(
  _table: T,
  data: Database['public']['Tables'][T]['Insert'],
) {
  return data;
}

// Type helper for update operations
export function createUpdateData<T extends keyof Database['public']['Tables']>(
  _table: T,
  data: Partial<Database['public']['Tables'][T]['Update']>,
) {
  return data;
}

// Example usage in hooks:
/*
// Instead of:
const { data, error } = await (supabase as any)
  .from('customer_feedback')
  .update({ status: 'acknowledged' })
  
// Use:
const updateData = createUpdateData('customer_feedback', { status: 'acknowledged' });
const { data, error } = await supabaseV2
  .from('customer_feedback')
  .update(updateData)
*/
