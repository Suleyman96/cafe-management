/**
 * Centralized query key constants for customer-web.
 * Single source of truth — prevents typo bugs and makes refactoring safe.
 */

export const QUERY_KEYS = {
  TABLE: 'table',
  ORDER: 'order',
  DELIVERY_ORDER: 'delivery_order',
  CATEGORIES: 'categories',
  MENU_ITEMS: 'menu_items',
  MENU_ITEM: 'menu_item',
  WAITER_CALLS: 'waiter_calls',
  CAFE_SETTINGS: 'cafe_settings',
} as const;

/** Stale time presets (ms) */
export const STALE_TIMES = {
  SHORT: 1000 * 60, // 1 minute
  MEDIUM: 1000 * 60 * 5, // 5 minutes
} as const;
