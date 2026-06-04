/**
 * Centralized React Query key constants.
 *
 * Lives here (not in `@gustri/core`) because keys are TanStack-specific —
 * core stays headless and provider-agnostic. Every query/mutation in this
 * package and every consumer app imports from here.
 */
export const QUERY_KEYS = {
  TABLES: 'tables',
  TABLE: 'table',
  TABLE_QR: 'table_qr',
  ORDERS: 'orders',
  ORDER: 'order',
  MENU_ITEMS: 'menu_items',
  MENU_ITEM: 'menu_item',
  MENU_ITEM_OPTIONS: 'menu_item_options',
  CATEGORIES: 'categories',
  STAFF: 'staff',
  WAITER_CALLS: 'waiter_calls',
  ACTIVE_ORDERS: 'active_orders',
  SALES: 'sales',
  CAFE_SETTINGS: 'cafe_settings',
  STOCK_ITEMS: 'stock_items',
  STOCK_ITEM: 'stock_item',
  STOCK_MOVEMENTS: 'stock_movements',
  LOW_STOCK_COUNT: 'low_stock_count',
  EXPENSE_CATEGORIES: 'expense_categories',
  EXPENSES: 'expenses',
  EXPENSE: 'expense',
  EXPENSE_MONTHLY_SUMMARY: 'expense_monthly_summary',
  SCHEDULES: 'schedules',
  MY_SCHEDULE: 'my_schedule',
  DELIVERY_ORDER: 'delivery_order',
  DELIVERY_ORDERS: 'delivery_orders',
  DELIVERY_CUSTOMERS: 'delivery_customers',
  DELIVERY_CUSTOMER: 'delivery_customer',
  TAKEOUT_ORDER: 'takeout_order',
  TAKEOUT_ORDERS: 'takeout_orders',
  WASTE_LOGS: 'waste_logs',
  WASTE_LOG: 'waste_log',
  WASTE_SUMMARY: 'waste_summary',
  TASKS: 'tasks',
  TASK: 'task',
  OVERDUE_TASKS_COUNT: 'overdue_tasks_count',
  OPEN_TASKS_COUNT: 'open_tasks_count',
  PAYMENTS: 'payments',
  REPORTS: 'reports',
  FEEDBACK: 'feedback',
  STAFF_MEMBER: 'staff_member',
  PAYMENTS_BY_STAFF: 'payments_by_staff',
  WAITER_CALLS_COUNT: 'waiter_calls_count',
  Z_REPORT: 'z_report',
  TENANT: 'tenant',
  MONTHLY_ORDER_COUNT: 'monthly_order_count',
  STAFF_KITCHEN_FILTERS: 'staff_kitchen_filters',
} as const;

/**
 * Sentinel used in query keys when no tenant is bound. We avoid using `null`
 * directly because TanStack treats it as a real key segment — keeping the
 * sentinel distinct from a bound `tenantId` makes accidental cross-context
 * matches obvious in devtools.
 */
export const NO_TENANT_KEY_SEGMENT = '__no_tenant__' as const;

/**
 * Build a tenant-scoped React Query key. Every query/mutation in this
 * package wraps its logical key with this helper so two tenants never
 * share a cache slot.
 *
 * Shape: `[<key>, <tenantId | sentinel>, ...rest]`. The logical key stays
 * first so devtools group-by-name still works; the tenant sits one level
 * deep so partial-match invalidations like
 * `invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS, tenantId] })` only
 * touch the current tenant's entries.
 */
export function tenantKey(
  tenantId: string | null | undefined,
  key: string,
  ...rest: unknown[]
): readonly unknown[] {
  return [key, tenantId ?? NO_TENANT_KEY_SEGMENT, ...rest] as const;
}
