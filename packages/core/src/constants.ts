/**
 * Shared Constants
 * Used across all platforms
 */

// Order statuses
export const ORDER_STATUS = {
  PENDING_APPROVAL: 'pending_approval',
  NEW: 'new',
  PREPARING: 'preparing',
  READY: 'ready',
  SERVED: 'served',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
} as const;

// Table statuses
export const TABLE_STATUS = {
  FREE: 'free',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
  CLOSED: 'closed',
} as const;

// User roles
export const USER_ROLE = {
  WAITER: 'waiter',
  ADMIN: 'admin',
  KITCHEN: 'kitchen',
} as const;

// Order item statuses
export const ORDER_ITEM_STATUS = {
  PENDING: 'pending',
  PREPARING: 'preparing',
  READY: 'ready',
  SERVED: 'served',
} as const;

// Waiter call statuses
export const WAITER_CALL_STATUS = {
  PENDING: 'pending',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
} as const;

// Waiter call reasons
export const WAITER_CALL_REASONS = [
  { value: 'assistance', label: 'General Help', emoji: '💬' },
  { value: 'bill', label: 'Request Bill', emoji: '🧾' },
  { value: 'cutlery', label: 'Bring Cutlery', emoji: '🍽️' },
  { value: 'complaint', label: 'Complaint', emoji: '⚠️' },
] as const;

// Languages
export const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'az', name: 'Azərbaycan', flag: '🇦🇿' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
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
  cancelled: '#9CA3AF', // gray-400
} as const;

// Schedule statuses
export const SCHEDULE_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  MISSED: 'missed',
} as const;

// Notification sounds
export const SOUNDS = {
  NEW_ORDER: 'new-order',
  WAITER_CALL: 'waiter-call',
  ORDER_READY: 'order-ready',
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  LANGUAGE: 'cafe-language',
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
} as const;

// UI constants
export const UI = {
  MIN_TOUCH_TARGET: 44, // 44x44px minimum
  MAX_CONTENT_WIDTH: 1200,
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 1024,
} as const;
