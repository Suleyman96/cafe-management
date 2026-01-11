import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@cafe-idare/database';

export type TypedSupabaseClient = SupabaseClient<Database>;

export interface QueryOptions {
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  offset?: number;
}

export interface MutationResult<T = any> {
  data: T | null;
  error: Error | null;
}