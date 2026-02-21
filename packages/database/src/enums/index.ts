/**
 * Database enums and constants
 */

export const ORDER_STATUS = {
  NEW: 'new',
  PREPARING: 'preparing',
  READY: 'ready',
  SERVED: 'served',
  PAID: 'paid',
  CANCELLED: 'cancelled',
} as const;

export const ORDER_SOURCE = {
  CUSTOMER: 'customer',
  WAITER: 'waiter',
  PHONE: 'phone',
} as const;

export const TABLE_STATUS = {
  FREE: 'free',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
  CLOSED: 'closed',
} as const;

export const PAYMENT_METHOD = {
  CASH: 'cash',
  CARD: 'card',
  DIGITAL: 'digital',
} as const;

export const PAYMENT_TYPE = {
  FULL: 'full',
  PARTIAL_AMOUNT: 'partial_amount',
  SPECIFIC_ITEMS: 'specific_items',
} as const;

export const WAITER_CALL_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
} as const;

export const WAITER_CALL_REASON = {
  ASSISTANCE: 'assistance',
  BILL: 'bill',
  COMPLAINT: 'complaint',
  QUESTION: 'question',
  EMERGENCY: 'emergency',
} as const;

export const FEEDBACK_TYPE = {
  COMPLAINT: 'complaint',
  QUESTION: 'question',
  REQUEST: 'request',
  PRAISE: 'praise',
} as const;

export const FEEDBACK_STATUS = {
  PENDING: 'pending',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
} as const;

export const USER_ROLE = {
  WAITER: 'waiter',
  ADMIN: 'admin',
  KITCHEN: 'kitchen',
} as const;

export const LANGUAGE = {
  EN: 'en',
  AZ: 'az',
  RU: 'ru',
  TR: 'tr',
} as const;
