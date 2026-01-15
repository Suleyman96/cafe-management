/**
 * Shared types for Supabase wrapper modules
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@cafe-idare/database';

// Type aliases for cleaner code
export type Tables = Database['public']['Tables'];
export type TableRow = Tables['tables']['Row'];
export type TableInsert = Tables['tables']['Insert'];
export type TableUpdate = Tables['tables']['Update'];
export type OrderRow = Tables['orders']['Row'];
export type OrderInsert = Tables['orders']['Insert'];
export type OrderItemInsert = Tables['order_items']['Insert'];
export type OrderItemRow = Tables['order_items']['Row'];
export type MenuItemRow = Tables['menu_items']['Row'];
export type MenuItemInsert = Tables['menu_items']['Insert'];
export type MenuItemUpdate = Tables['menu_items']['Update'];
export type CategoryRow = Tables['categories']['Row'];
export type CategoryInsert = Tables['categories']['Insert'];
export type CategoryUpdate = Tables['categories']['Update'];
export type CustomerFeedbackRow = Tables['customer_feedback']['Row'];
export type OrderPaymentInsert = Tables['order_payments']['Insert'];
export type StaffRow = Tables['staff']['Row'];
export type StaffInsert = Tables['staff']['Insert'];
export type StaffUpdate = Tables['staff']['Update'];
export type WaiterCallRow = Tables['waiter_calls']['Row'];

// Helper type for Supabase client that bypasses strict typing
export type AnySupabaseClient = SupabaseClient<any>;
export type TypedSupabaseClient = SupabaseClient<Database>;

// Base context passed to all wrapper modules
export interface WrapperContext {
  client: TypedSupabaseClient;
  anyClient: AnySupabaseClient;
}
