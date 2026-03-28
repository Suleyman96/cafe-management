/**
 * Type Guards
 * Runtime type checking utilities
 */

import type {
  Category,
  CustomerFeedback,
  Expense,
  ExpenseCategory,
  MenuItem,
  Order,
  OrderItem,
  OrderPayment,
  Staff,
  StaffSchedule,
  StockItem,
  StockMovement,
  Table,
  TableTransfer,
  Task,
  WaiterCall,
  WasteLog,
} from '@gustri/database';

// Order type guards
export function isOrder(value: unknown): value is Order {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'status' in value &&
    'created_at' in value
  );
}

export function hasOrderItems(
  order: Order & { order_items?: unknown[] },
): order is Order & { order_items: OrderItem[] } {
  return Array.isArray(order.order_items) && order.order_items.length > 0;
}

// Table type guards
export function isTable(value: unknown): value is Table {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'table_number' in value &&
    'status' in value
  );
}

export function isOccupiedTable(table: Table): boolean {
  return table.status === 'occupied';
}

// Staff type guards
export function isStaff(value: unknown): value is Staff {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value &&
    'role' in value
  );
}

export function isWaiter(staff: Staff): boolean {
  return staff.role === 'waiter';
}

export function isAdmin(staff: Staff): boolean {
  return staff.role === 'admin';
}

export function isKitchen(staff: Staff): boolean {
  return staff.role === 'kitchen';
}

export function isOwner(staff: Staff): boolean {
  return staff.role === 'owner';
}

// Menu item type guards
export function isMenuItem(value: unknown): value is MenuItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'price' in value
  );
}

export function isAvailableMenuItem(item: MenuItem): boolean {
  return item.is_available === true;
}

// Category type guards
export function isCategory(value: unknown): value is Category {
  return typeof value === 'object' && value !== null && 'id' in value && 'name' in value;
}

// Waiter call type guards
export function isWaiterCall(value: unknown): value is WaiterCall {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'table_id' in value &&
    'reason' in value &&
    'status' in value
  );
}

export function isPendingWaiterCall(call: WaiterCall): boolean {
  return call.status === 'pending';
}

// Customer feedback type guards
export function isCustomerFeedback(value: unknown): value is CustomerFeedback {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'feedback_type' in value &&
    'message' in value &&
    'status' in value
  );
}

export function isPendingFeedback(feedback: CustomerFeedback): boolean {
  return feedback.status === 'pending';
}

// Payment type guards
export function isOrderPayment(value: unknown): value is OrderPayment {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'order_id' in value &&
    'amount' in value &&
    'payment_method' in value
  );
}

// Table transfer type guards
export function isTableTransfer(value: unknown): value is TableTransfer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'order_id' in value &&
    'from_table_id' in value &&
    'to_table_id' in value
  );
}

// Utility function to safely access nested properties
export function safeGet<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  defaultValue: T[K] | null = null,
): T[K] | null {
  return obj?.[key] ?? defaultValue;
}

// Type assertion with validation
export function assertType<T>(
  value: unknown,
  guard: (value: unknown) => value is T,
  errorMessage: string,
): T {
  if (!guard(value)) {
    throw new TypeError(errorMessage);
  }
  return value;
}

// Array type guards
export function isOrderArray(value: unknown): value is Order[] {
  return Array.isArray(value) && value.every(isOrder);
}

export function isTableArray(value: unknown): value is Table[] {
  return Array.isArray(value) && value.every(isTable);
}

export function isMenuItemArray(value: unknown): value is MenuItem[] {
  return Array.isArray(value) && value.every(isMenuItem);
}

export function isCategoryArray(value: unknown): value is Category[] {
  return Array.isArray(value) && value.every(isCategory);
}

export function isStaffArray(value: unknown): value is Staff[] {
  return Array.isArray(value) && value.every(isStaff);
}

export function isWaiterCallArray(value: unknown): value is WaiterCall[] {
  return Array.isArray(value) && value.every(isWaiterCall);
}

export function isCustomerFeedbackArray(value: unknown): value is CustomerFeedback[] {
  return Array.isArray(value) && value.every(isCustomerFeedback);
}

export function isOrderPaymentArray(value: unknown): value is OrderPayment[] {
  return Array.isArray(value) && value.every(isOrderPayment);
}

// OrderItem type guard
export function isOrderItem(value: unknown): value is OrderItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'order_id' in value &&
    'menu_item_id' in value &&
    'quantity' in value &&
    'item_price' in value
  );
}

export function isOrderItemArray(value: unknown): value is OrderItem[] {
  return Array.isArray(value) && value.every(isOrderItem);
}

// Stock item type guards
export function isStockItem(value: unknown): value is StockItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'quantity' in value &&
    'unit' in value
  );
}

export function isStockMovement(value: unknown): value is StockMovement {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'stock_item_id' in value &&
    'movement_type' in value &&
    'quantity_change' in value
  );
}

// Expense type guards
export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'is_active' in value
  );
}

export function isExpense(value: unknown): value is Expense {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'amount' in value &&
    'description' in value &&
    'payment_method' in value
  );
}

// Order type helpers
export function isDeliveryOrder(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'order_type' in value &&
    (value as Record<string, unknown>).order_type === 'delivery'
  );
}

// Staff schedule type guards
export function isStaffSchedule(value: unknown): value is StaffSchedule {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'staff_id' in value &&
    'date' in value &&
    'planned_start' in value &&
    'planned_end' in value &&
    'status' in value
  );
}

export function isStaffScheduleArray(value: unknown): value is StaffSchedule[] {
  return Array.isArray(value) && value.every(isStaffSchedule);
}

// Waste log type guards
export function isWasteLog(value: unknown): value is WasteLog {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'item_name' in value &&
    'quantity' in value &&
    'reason' in value
  );
}

export function isWasteLogArray(value: unknown): value is WasteLog[] {
  return Array.isArray(value) && value.every(isWasteLog);
}

// Task type guards
export function isTask(value: unknown): value is Task {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'status' in value &&
    'priority' in value
  );
}

export function isTaskArray(value: unknown): value is Task[] {
  return Array.isArray(value) && value.every(isTask);
}
