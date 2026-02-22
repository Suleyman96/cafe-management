/**
 * API Client Package
 * Provides type-safe database operations via SupabaseWrapper
 */

// Re-export commonly used types from database
export type {
  Categories,
  CategoriesInsert,
  CategoriesUpdate,
  Expense,
  ExpenseCategory,
  ExpenseCategoryInsert,
  ExpenseInsert,
  ExpenseUpdate,
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
  StockItem,
  StockItemInsert,
  StockItemUpdate,
  StockMovement,
  StockMovementInsert,
  Tables,
  TablesInsert,
  TablesUpdate,
  WaiterCalls,
  WaiterCallsInsert,
  WaiterCallsUpdate,
} from '@cafe-idare/database';

// Export Supabase wrapper (the primary API)
export * from './wrapper';
