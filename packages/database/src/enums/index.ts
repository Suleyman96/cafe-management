/**
 * Database enums and constants
 *
 * Single source of truth for all database CHECK constraint values.
 * These MUST match the PostgreSQL CHECK constraints exactly.
 */

// Order statuses — matches orders_status_check constraint
export const ORDER_STATUS = {
  PENDING_APPROVAL: 'pending_approval',
  NEW: 'new',
  PREPARING: 'preparing',
  READY: 'ready',
  SERVED: 'served',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
} as const;

// Order source
export const ORDER_SOURCE = {
  CUSTOMER: 'customer',
  WAITER: 'waiter',
  PHONE: 'phone',
} as const;

// Order type — matches orders_order_type_check constraint
export const ORDER_TYPE = {
  DINE_IN: 'dine_in',
  TAKEOUT: 'takeout',
  DELIVERY: 'delivery',
} as const;

// Order item statuses — matches order_items_status_check constraint
export const ORDER_ITEM_STATUS = {
  PENDING: 'pending',
  PREPARING: 'preparing',
  READY: 'ready',
  SERVED: 'served',
  CANCELLED: 'cancelled',
} as const;

// Table statuses — matches tables_status_check constraint
export const TABLE_STATUS = {
  FREE: 'free',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
  CLOSED: 'closed',
} as const;

// Payment method — matches order_payments_payment_method_check constraint
export const PAYMENT_METHOD = {
  CASH: 'cash',
  CARD: 'card',
  DIGITAL: 'digital',
} as const;

// Payment type — matches order_payments_payment_type_check constraint
export const PAYMENT_TYPE = {
  FULL: 'full',
  PARTIAL_AMOUNT: 'partial_amount',
  SPECIFIC_ITEMS: 'specific_items',
} as const;

// Discount type — matches orders_discount_type_check constraint
export const DISCOUNT_TYPE = {
  NONE: 'none',
  PERCENTAGE: 'percentage',
  FIXED: 'fixed',
} as const;

// Refund method — matches refunds_refund_method_check constraint
export const REFUND_METHOD = {
  CASH: 'cash',
  CARD: 'card',
  DIGITAL: 'digital',
} as const;

// Waiter call statuses — matches waiter_calls_status_check constraint
export const WAITER_CALL_STATUS = {
  PENDING: 'pending',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
} as const;

// Waiter call reason/type — matches waiter_calls call_type column
export const WAITER_CALL_REASON = {
  ASSISTANCE: 'assistance',
  BILL: 'bill',
  COMPLAINT: 'complaint',
  QUESTION: 'question',
  EMERGENCY: 'emergency',
} as const;

// Waiter call priority — matches waiter_calls priority column
export const WAITER_CALL_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

// Feedback type — matches customer_feedback_feedback_type_check constraint
export const FEEDBACK_TYPE = {
  COMPLAINT_FOOD: 'complaint_food',
  COMPLAINT_SERVICE: 'complaint_service',
  COMPLAINT_STAFF: 'complaint_staff',
  QUESTION_MENU: 'question_menu',
  REQUEST_GENERAL: 'request_general',
  PRAISE: 'praise',
} as const;

// Feedback status — matches customer_feedback_status_check constraint
export const FEEDBACK_STATUS = {
  PENDING: 'pending',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
} as const;

// User roles — matches staff_role_check constraint
export const USER_ROLE = {
  WAITER: 'waiter',
  ADMIN: 'admin',
  KITCHEN: 'kitchen',
  OWNER: 'owner',
} as const;

// Stock movement type — matches stock_movements_movement_type_check constraint
export const STOCK_MOVEMENT_TYPE = {
  IN: 'in',
  OUT: 'out',
  ADJUSTMENT: 'adjustment',
} as const;

// Stock units
export const STOCK_UNIT = {
  PIECES: 'pieces',
  KG: 'kg',
  LITERS: 'liters',
  BOXES: 'boxes',
  BAGS: 'bags',
} as const;

// Expense payment method — matches expenses_payment_method_check constraint
export const EXPENSE_PAYMENT_METHOD = {
  CASH: 'cash',
  CARD: 'card',
  DIGITAL: 'digital',
  BANK_TRANSFER: 'bank_transfer',
} as const;

// Waste log reason — matches waste_logs_reason_check constraint
export const WASTE_REASON = {
  EXPIRED: 'expired',
  SPOILED: 'spoiled',
  OVERCOOKED: 'overcooked',
  DROPPED: 'dropped',
  RETURNED_BY_CUSTOMER: 'returned_by_customer',
  PREPARATION_WASTE: 'preparation_waste',
  OTHER: 'other',
} as const;

// Task status — matches tasks_status_check constraint
export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

// Task priority — matches tasks_priority_check constraint
export const TASK_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

// Task recurrence pattern — matches tasks_recurrence_pattern_check constraint
export const TASK_RECURRENCE = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const;

// Staff schedule status — matches staff_schedules_status_check constraint
export const SCHEDULE_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  MISSED: 'missed',
} as const;

// Currency position — matches cafe_settings_currency_position_check constraint
export const CURRENCY_POSITION = {
  BEFORE: 'before',
  AFTER: 'after',
} as const;
