/**
 * Supabase Type Helpers
 * Utilities to work around Supabase client typing issues
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/database';

// Typed Supabase client
export type TypedSupabaseClient = SupabaseClient<Database>;
