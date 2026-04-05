/**
 * Shared Constants
 * Used across all platforms
 */

// Re-export all DB enums from the single source of truth
export {
  CURRENCY_POSITION,
  EXPENSE_PAYMENT_METHOD,
  FEEDBACK_STATUS,
  FEEDBACK_TYPE,
  ORDER_ITEM_STATUS,
  ORDER_SOURCE,
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_METHOD,
  PAYMENT_TYPE,
  REFUND_METHOD,
  SCHEDULE_STATUS,
  STOCK_MOVEMENT_TYPE,
  STOCK_UNIT,
  TABLE_STATUS,
  TASK_PRIORITY,
  TASK_RECURRENCE,
  TASK_STATUS,
  USER_ROLE,
  WAITER_CALL_PRIORITY,
  WAITER_CALL_REASON,
  WAITER_CALL_STATUS,
  WASTE_REASON,
} from '@gustri/database';

// Waiter call reasons (UI-specific with labels and emojis)
export const WAITER_CALL_REASONS = [
  { value: 'assistance', label: 'General Help', emoji: '💬' },
  { value: 'bill', label: 'Request Bill', emoji: '🧾' },
  { value: 'question', label: 'Question', emoji: '❓' },
  { value: 'complaint', label: 'Complaint', emoji: '⚠️' },
  { value: 'emergency', label: 'Emergency', emoji: '🚨' },
] as const;

// Tax rate
export const TAX_RATE = 0.18; // 18%

// Refresh intervals (ms)
export const REFRESH_INTERVALS = {
  ORDERS: 30000, // 30 seconds
  KITCHEN: 10000, // 10 seconds
  WAITER_CALLS: 15000, // 15 seconds
  TABLES: 60000, // 1 minute
} as const;

// Status colors
export const STATUS_COLORS = {
  pending_approval: '#D97706', // amber-600
  new: '#EF4444', // red-500
  preparing: '#F59E0B', // amber-500
  ready: '#10B981', // green-500
  served: '#6B7280', // gray-500
  closed: '#374151', // gray-700
  out_for_delivery: '#8B5CF6', // purple-500
  delivered: '#10B981', // green-500
  cancelled: '#9CA3AF', // gray-400
} as const;

// Notification sounds
export const SOUNDS = {
  NEW_ORDER: 'new-order',
  WAITER_CALL: 'waiter-call',
  ORDER_READY: 'order-ready',
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  CART: 'cafe-cart',
  AUTH_TOKEN: 'cafe-auth-token',
  USER: 'cafe-user',
} as const;

// API endpoints (relative to Supabase URL)
export const API_ENDPOINTS = {
  TABLES: '/rest/v1/tables',
  ORDERS: '/rest/v1/orders',
  ORDER_ITEMS: '/rest/v1/order_items',
  MENU_ITEMS: '/rest/v1/menu_items',
  CATEGORIES: '/rest/v1/categories',
  STAFF: '/rest/v1/staff',
  WAITER_CALLS: '/rest/v1/waiter_calls',
  ACTIVE_ORDERS: '/rest/v1/active_orders_view',
  SALES_SUMMARY: '/rest/v1/sales_summary_view',
} as const;

// Query keys for React Query
export const QUERY_KEYS = {
  TABLES: 'tables',
  TABLE: 'table',
  TABLE_QR: 'table_qr',
  ORDERS: 'orders',
  ORDER: 'order',
  MENU_ITEMS: 'menu_items',
  MENU_ITEM: 'menu_item',
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
  FEEDBACK: 'feedback',
  STAFF_MEMBER: 'staff_member',
  PAYMENTS_BY_STAFF: 'payments_by_staff',
  WAITER_CALLS_COUNT: 'waiter_calls_count',
  Z_REPORT: 'z_report',
} as const;

// 30-minute interval time slots (00:00 to 23:30)
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours = String(Math.floor(i / 2)).padStart(2, '0');
  const minutes = i % 2 === 0 ? '00' : '30';
  return `${hours}:${minutes}`;
});

// Weekdays with Sunday=0 (matches JS Date.getDay())
export const DAYS_OF_WEEK = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
] as const;

// Weekdays with Sunday=7 (1-7 numbering for recurrence)
export const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
] as const;

// UI constants
export const UI = {
  MIN_TOUCH_TARGET: 44, // 44x44px minimum
  MAX_CONTENT_WIDTH: 1200,
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 1024,
} as const;
