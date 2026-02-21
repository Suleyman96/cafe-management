/**
 * API Client Package
 * Provides all database operations and real-time subscriptions
 */

// Re-export commonly used types from database
export type {
  Categories,
  CategoriesInsert,
  CategoriesUpdate,
  Feedback,
  FeedbackInsert,
  FeedbackUpdate,
  MenuItems,
  MenuItemsInsert,
  MenuItemsUpdate,
  OrderItems,
  OrderItemsInsert,
  OrderItemsUpdate,
  Orders,
  OrdersInsert,
  OrdersUpdate,
  Staff,
  StaffInsert,
  StaffUpdate,
  Tables,
  TablesInsert,
  TablesUpdate,
  WaiterCalls,
  WaiterCallsInsert,
  WaiterCallsUpdate,
} from '@cafe-idare/database';
export * from './analytics';
export * from './categories';
export * from './feedback';
export * from './menu-items';
export * from './order-items';
export * from './orders';
// Export realtime subscriptions
export * from './realtime';
export * from './staff';
// Export Supabase wrapper
export * from './supabase-wrapper';
// Export table operations
export * from './tables';
// Export types
export * from './types';
export * from './waiter-calls';
