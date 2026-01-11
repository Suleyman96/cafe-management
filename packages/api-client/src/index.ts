/**
 * API Client Package
 * Provides all database operations and real-time subscriptions
 */

// Export types
export * from './types';

// Export table operations
export * from './tables';
export * from './orders';
export * from './order-items';
export * from './menu-items';
export * from './categories';
export * from './waiter-calls';
export * from './staff';
export * from './feedback';
export * from './analytics';

// Export realtime subscriptions
export * from './realtime';

// Export Supabase wrapper
export * from './supabase-wrapper';

// Re-export commonly used types from database
export type {
  Tables,
  TablesInsert,
  TablesUpdate,
  Orders,
  OrdersInsert,
  OrdersUpdate,
  OrderItems,
  OrderItemsInsert,
  OrderItemsUpdate,
  MenuItems,
  MenuItemsInsert,
  MenuItemsUpdate,
  Categories,
  CategoriesInsert,
  CategoriesUpdate,
  Staff,
  StaffInsert,
  StaffUpdate,
  WaiterCalls,
  WaiterCallsInsert,
  WaiterCallsUpdate,
  Feedback,
  FeedbackInsert,
  FeedbackUpdate,
} from '@cafe-idare/database';