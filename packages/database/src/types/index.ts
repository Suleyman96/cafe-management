/**
 * Shared Types
 * Used by: customer-web, staff-web, mobile-app
 *
 * Keep these platform-agnostic so they work everywhere!
 */

export * from './database';

// Re-export common types
import type { Database } from './database';

// Tenant type
export type Tenant = Database['public']['Tables']['tenants']['Row'];
export type TenantInsert = Database['public']['Tables']['tenants']['Insert'];
export type TenantUpdate = Database['public']['Tables']['tenants']['Update'];

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

export type StockItem = Database['public']['Tables']['stock_items']['Row'];
export type StockItemInsert = Database['public']['Tables']['stock_items']['Insert'];
export type StockItemUpdate = Database['public']['Tables']['stock_items']['Update'];
export type StockMovement = Database['public']['Tables']['stock_movements']['Row'];
export type StockMovementInsert = Database['public']['Tables']['stock_movements']['Insert'];
export type ExpenseCategory = Database['public']['Tables']['expense_categories']['Row'];
export type ExpenseCategoryInsert = Database['public']['Tables']['expense_categories']['Insert'];
export type Expense = Database['public']['Tables']['expenses']['Row'];
export type ExpenseInsert = Database['public']['Tables']['expenses']['Insert'];
export type ExpenseUpdate = Database['public']['Tables']['expenses']['Update'];

export type StaffSchedule = Database['public']['Tables']['staff_schedules']['Row'];
export type StaffScheduleInsert = Database['public']['Tables']['staff_schedules']['Insert'];
export type StaffScheduleUpdate = Database['public']['Tables']['staff_schedules']['Update'];

export type WasteLog = Database['public']['Tables']['waste_logs']['Row'];
export type WasteLogInsert = Database['public']['Tables']['waste_logs']['Insert'];
export type WasteLogUpdate = Database['public']['Tables']['waste_logs']['Update'];

export type Task = Database['public']['Tables']['tasks']['Row'];
export type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
export type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

export type Refund = Database['public']['Tables']['refunds']['Row'];
export type RefundInsert = Database['public']['Tables']['refunds']['Insert'];
export type RefundUpdate = Database['public']['Tables']['refunds']['Update'];

export type DeliveryCustomer = Database['public']['Tables']['delivery_customers']['Row'];
export type DeliveryCustomerInsert = Database['public']['Tables']['delivery_customers']['Insert'];
export type DeliveryCustomerUpdate = Database['public']['Tables']['delivery_customers']['Update'];

// Discriminated union types for Order based on order_type
export interface DineInOrder extends Order {
  order_type: 'dine_in';
  table_id: string;
}

export interface DeliveryOrder extends Order {
  order_type: 'delivery';
  table_id: null;
  delivery_address: string;
}

export interface TakeoutOrder extends Order {
  order_type: 'takeout';
  table_id: null;
}

export type TypedOrder = DineInOrder | DeliveryOrder | TakeoutOrder;

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

// Waste log with staff and stock item info
export interface WasteLogWithDetails extends WasteLog {
  logged_by_staff: Pick<Staff, 'full_name'> | null;
  stock_item: Pick<StockItem, 'name' | 'unit'> | null;
}

// Task with staff info
export interface TaskWithDetails extends Task {
  assigned_to_staff: Pick<Staff, 'full_name'> | null;
  created_by_staff: Pick<Staff, 'full_name'> | null;
}

// Refund with staff info
export interface RefundWithStaff extends Refund {
  processed_by_staff: Pick<Staff, 'full_name' | 'role'>;
}

// Stock movement with staff info
export interface StockMovementWithStaff extends StockMovement {
  performed_by_staff: Pick<Staff, 'full_name'> | null;
}

// Expense with category and staff info
export interface ExpenseWithCategory extends Expense {
  category: ExpenseCategory | null;
  created_by_staff: Pick<Staff, 'full_name'> | null;
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

// Status types are now exported from schemas/index.ts via Zod inference.
// Only export aliases that don't conflict with schema exports.
export type CallType = WaiterCall['call_type'];
export type CallPriority = WaiterCall['priority'];
