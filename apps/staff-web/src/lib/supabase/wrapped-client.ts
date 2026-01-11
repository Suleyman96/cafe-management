/**
 * Wrapped Supabase Client
 * Uses the comprehensive wrapper for type-safe operations
 */

import { createClient } from '@supabase/supabase-js';
import { createSupabaseWrapper } from '@cafe-idare/api-client';
import type { Database } from '@cafe-idare/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create the base client
const baseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Create the wrapped client with all type-safe methods
export const db = createSupabaseWrapper(baseClient);

// Export the base client for backward compatibility
export const supabase = baseClient;