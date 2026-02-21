/**
 * Typed Supabase Client
 * Simple client export - actual type safety is handled by the SupabaseWrapper
 */

import type { Database } from '@cafe-idare/database';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create and export the typed client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// For backwards compatibility
export const typedSupabase = supabase;
