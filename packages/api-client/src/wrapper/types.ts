/**
 * Shared types for Supabase wrapper modules
 */

import type { Database } from '@gustri/database/types';
import type { SupabaseClient } from '@supabase/supabase-js';

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
export type MenuItemOptionRow = Tables['menu_item_options']['Row'];
export type MenuItemOptionInsert = Tables['menu_item_options']['Insert'];
export type MenuItemOptionUpdate = Tables['menu_item_options']['Update'];
export type MenuItemOptionValueRow = Tables['menu_item_option_values']['Row'];
export type MenuItemOptionValueInsert = Tables['menu_item_option_values']['Insert'];
export type MenuItemOptionValueUpdate = Tables['menu_item_option_values']['Update'];
export type CustomerFeedbackRow = Tables['customer_feedback']['Row'];
export type OrderPaymentInsert = Tables['order_payments']['Insert'];
export type StaffRow = Tables['staff']['Row'];
export type StaffInsert = Tables['staff']['Insert'];
export type StaffUpdate = Tables['staff']['Update'];
export type WaiterCallRow = Tables['waiter_calls']['Row'];
export type StockItemRow = Tables['stock_items']['Row'];
export type StockItemInsert = Tables['stock_items']['Insert'];
export type StockItemUpdate = Tables['stock_items']['Update'];
export type StockMovementRow = Tables['stock_movements']['Row'];
export type StockMovementInsert = Tables['stock_movements']['Insert'];
export type ExpenseCategoryRow = Tables['expense_categories']['Row'];
export type ExpenseCategoryInsert = Tables['expense_categories']['Insert'];
export type ExpenseRow = Tables['expenses']['Row'];
export type ExpenseInsert = Tables['expenses']['Insert'];
export type ExpenseUpdate = Tables['expenses']['Update'];
export type StaffScheduleRow = Tables['staff_schedules']['Row'];
export type StaffScheduleInsert = Tables['staff_schedules']['Insert'];
export type StaffScheduleUpdate = Tables['staff_schedules']['Update'];
export type WasteLogRow = Tables['waste_logs']['Row'];
export type WasteLogInsert = Tables['waste_logs']['Insert'];
export type WasteLogUpdate = Tables['waste_logs']['Update'];
export type TaskRow = Tables['tasks']['Row'];
export type TaskInsert = Tables['tasks']['Insert'];
export type TaskUpdate = Tables['tasks']['Update'];
export type DeliveryCustomerRow = Tables['delivery_customers']['Row'];
export type DeliveryCustomerInsert = Tables['delivery_customers']['Insert'];
export type DeliveryCustomerUpdate = Tables['delivery_customers']['Update'];
export type TenantRow = Tables['tenants']['Row'];

// Pagination params for list queries
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

// Paginated result with total count for UI pagination controls
export interface PaginatedResult<T> {
  data: T[];
  count: number;
  hasMore: boolean;
}

/**
 * Supabase client that bypasses strict typing.
 * Required for INSERT/UPDATE/DELETE operations (Supabase SDK limitation with
 * .select() chains after mutations) and for querying database views
 * (active_orders_view, etc.) that are not in the generated Database type.
 */
export type AnySupabaseClient = SupabaseClient<any>;
export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Tenant context carried by every wrapper instance.
 *
 * The wrapper layer adds defense-in-depth tenant scoping on top of RLS:
 * every read on a tenant-scoped table appends `.eq('tenant_id', tenantId)`
 * when this is set. RLS remains the primary boundary; this ensures that
 * even if a future migration regresses RLS, cross-tenant reads can't slip
 * past the wrapper.
 *
 * `tenantId` is `null` when no session is bound (anon customer-web before
 * `set_table_context()` runs). Wrappers that legitimately need to operate
 * without a tenant (anon QR flows) check `allowNull` on the helper.
 */
export interface TenantContext {
  tenantId: string | null;
  setTenantId(id: string | null): void;
}

/**
 * In-process Sentry shim. The api-client package can't take a hard
 * dependency on either `@sentry/nextjs` or `@sentry/react-native`, so the
 * factory accepts a captureMessage hook from the host app. When unset (or
 * not in development) the tenant-context helpers stay silent.
 */
export interface SentryShim {
  captureMessage(message: string, options?: { level?: 'warning' | 'info' | 'error' }): void;
}

// Base context passed to all wrapper modules.
// `tenantContext` is optional only so that legacy test fixtures that
// constructed `{ client, anyClient }` directly continue to type-check;
// the wrapper factory always provides one. Helpers treat a missing
// `tenantContext` as "no tenant bound" (same as null).
export interface WrapperContext {
  client: TypedSupabaseClient;
  anyClient: AnySupabaseClient;
  tenantContext?: TenantContext;
  sentry?: SentryShim;
}
