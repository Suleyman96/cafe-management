/**
 * Shared Types
 * Used by: customer-web, staff-web, mobile-app
 * 
 * Keep these platform-agnostic so they work everywhere!
 */

export * from './database';

// Re-export common types
import type { Database } from './database';

// Main types
export type Table = Database['public']['Tables']['tables']['Row'];
export type Tables = Table; // Alias for compatibility
export type TablesInsert = Database['public']['Tables']['tables']['Insert'];
export type TablesUpdate = Database['public']['Tables']['tables']['Update'];

export type Category = Database['public']['Tables']['categories']['Row'];
export type Categories = Category; // Alias for compatibility
export type CategoriesInsert = Database['public']['Tables']['categories']['Insert'];
export type CategoriesUpdate = Database['public']['Tables']['categories']['Update'];

export type MenuItem = Database['public']['Tables']['menu_items']['Row'];
export type MenuItems = MenuItem; // Alias for compatibility
export type MenuItemsInsert = Database['public']['Tables']['menu_items']['Insert'];
export type MenuItemsUpdate = Database['public']['Tables']['menu_items']['Update'];

export type Order = Database['public']['Tables']['orders']['Row'];
export type Orders = Order; // Alias for compatibility
export type OrdersInsert = Database['public']['Tables']['orders']['Insert'];
export type OrdersUpdate = Database['public']['Tables']['orders']['Update'];

export type OrderItem = Database['public']['Tables']['order_items']['Row'];
export type OrderItems = OrderItem; // Alias for compatibility
export type OrderItemsInsert = Database['public']['Tables']['order_items']['Insert'];
export type OrderItemsUpdate = Database['public']['Tables']['order_items']['Update'];

export type WaiterCall = Database['public']['Tables']['waiter_calls']['Row'];
export type WaiterCalls = WaiterCall; // Alias for compatibility
export type WaiterCallsInsert = Database['public']['Tables']['waiter_calls']['Insert'];
export type WaiterCallsUpdate = Database['public']['Tables']['waiter_calls']['Update'];

export type Staff = Database['public']['Tables']['staff']['Row'];
export type StaffInsert = Database['public']['Tables']['staff']['Insert'];
export type StaffUpdate = Database['public']['Tables']['staff']['Update'];

export type CustomerFeedback = Database['public']['Tables']['customer_feedback']['Row'];
export type Feedback = CustomerFeedback; // Alias for compatibility
export type FeedbackInsert = Database['public']['Tables']['customer_feedback']['Insert'];
export type FeedbackUpdate = Database['public']['Tables']['customer_feedback']['Update'];

export type OrderPayment = Database['public']['Tables']['order_payments']['Row'];
export type TableTransfer = Database['public']['Tables']['table_transfers']['Row'];

// Extended types with relations
export interface OrderWithDetails extends Order {
  table: Pick<Table, 'table_number' | 'location'>;
  order_items: OrderItemWithMenuItem[];
  assigned_waiter?: Pick<Staff, 'full_name'>;
}

export interface OrderItemWithMenuItem extends OrderItem {
  menu_item?: MenuItem;
}

export interface WaiterCallWithTable extends WaiterCall {
  table: Pick<Table, 'table_number' | 'location'>;
}

export interface MenuItemWithCategory extends MenuItem {
  category: Category | null;
}

// Extended order with payment information
export interface OrderWithPayments extends Order {
  payments: OrderPaymentWithStaff[];
  paid_amount: number;
  remaining_balance: number;
}

export interface OrderPaymentWithStaff extends OrderPayment {
  received_by_staff: Pick<Staff, 'full_name' | 'role'>;
}

export interface CustomerFeedbackWithTable extends CustomerFeedback {
  table: Pick<Table, 'table_number' | 'location'> | null;
  responded_by_staff: Pick<Staff, 'full_name' | 'role'> | null;
}

export interface TableTransferWithDetails extends TableTransfer {
  from_table: Pick<Table, 'table_number' | 'location'>;
  to_table: Pick<Table, 'table_number' | 'location'>;
  transferred_by_staff: Pick<Staff, 'full_name' | 'role'>;
}

// Order with all related data for staff views
export interface OrderWithItems extends Order {
  table?: Table;
  staff?: Staff;
  order_items: OrderItemWithMenuItem[];
  order_payments?: OrderPayment[];
  table_transfers?: TableTransferWithDetails[];
}

// Cart item (client-side only)
export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

// Language support
export type Language = 'en' | 'az' | 'ru' | 'tr';

// Status types - commented out to avoid conflict with enum exports
// export type OrderStatus = Order['status'];
export type OrderType = Order['order_type'];
// export type TableStatus = Table['status'];
export type UserRole = Staff['role'];
export type FeedbackType = CustomerFeedback['feedback_type'];
export type FeedbackStatus = CustomerFeedback['status'];
export type PaymentType = OrderPayment['payment_type'];
export type PaymentMethod = OrderPayment['payment_method'];
export type CallType = WaiterCall['call_type'];
export type CallPriority = WaiterCall['priority'];

// Helper function for localized content
export function getLocalizedField<T>(
  item: T,
  field: string,
  language: Language
): string {
  const key = `${field}_${language}` as keyof T;
  return (item[key] as string) || (item[`${field}_en` as keyof T] as string) || '';
}

// Type guards
export function isWaiter(staff: Staff): boolean {
  return staff.role === 'waiter';
}

export function isAdmin(staff: Staff): boolean {
  return staff.role === 'admin';
}

export function isKitchen(staff: Staff): boolean {
  return staff.role === 'kitchen';
}

// Order type guards
export function isDineInOrder(order: Order): boolean {
  return order.order_type === 'dine_in';
}

export function isTakeoutOrder(order: Order): boolean {
  return order.order_type === 'takeout';
}

// Payment status helper
export function isOrderFullyPaid(order: OrderWithPayments): boolean {
  return order.remaining_balance <= 0;
}

export function isOrderPartiallyPaid(order: OrderWithPayments): boolean {
  return order.paid_amount > 0 && order.remaining_balance > 0;
}

