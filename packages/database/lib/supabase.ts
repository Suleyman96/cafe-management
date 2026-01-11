/**
 * Supabase Client Factory
 * 
 * This allows the shared hooks to work with Supabase clients
 * initialized in each app (customer-web, staff-web, mobile-app)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

let supabaseClient: SupabaseClient<Database> | null = null;

/**
 * Initialize the shared Supabase client
 * Call this in each app's initialization
 */
export function initSupabaseClient(client: SupabaseClient<Database>) {
  supabaseClient = client;
}

/**
 * Get the Supabase client
 * Throws if not initialized
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseClient) {
    throw new Error(
      'Supabase client not initialized. Call initSupabaseClient() first.'
    );
  }
  return supabaseClient;
}

/**
 * Export supabase for backward compatibility
 * Use getSupabaseClient() in new code
 */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    return getSupabaseClient()[prop as keyof SupabaseClient<Database>];
  },
});

