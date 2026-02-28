/**
 * Wrapped Supabase Client
 * Uses the comprehensive wrapper for type-safe operations.
 * Re-uses the single shared Supabase client to avoid dual GoTrueClient issues.
 */

import { createSupabaseWrapper } from '@cafe-idare/api-client';
import { supabase } from './client';

// Create the wrapped client with all type-safe methods, using the shared client
export const db = createSupabaseWrapper(supabase);

// Re-export the shared client for convenience
export { supabase };
