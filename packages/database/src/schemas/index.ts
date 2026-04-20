/**
 * Zod schemas for runtime validation
 *
 * Each schema mirrors the corresponding database table Row type.
 * Enum schemas are derived from the enums in ../enums/index.ts.
 */

import { z } from 'zod';

// ─── Enum Schemas ────────────────────────────────────────────────

export const OrderStatusSchema = z.enum([
  'pending_approval',
  'new',
  'preparing',
  'ready',
  'served',
  'out_for_delivery',
  'delivered',
  'closed',
  'cancelled',
]);

export const OrderSourceSchema = z.enum(['customer', 'waiter', 'phone']);

export const OrderTypeSchema = z.enum(['dine_in', 'takeout', 'delivery']);

export const OrderItemStatusSchema = z.enum([
  'pending',
  'preparing',
  'ready',
  'served',
  'cancelled',
]);

export const TableStatusSchema = z.enum(['free', 'occupied', 'reserved', 'closed']);

export const PaymentMethodSchema = z.enum(['cash', 'card', 'digital']);

export const PaymentTypeSchema = z.enum(['full', 'partial_amount', 'specific_items']);

export const DiscountTypeSchema = z.enum(['none', 'percentage', 'fixed']);

export const RefundMethodSchema = z.enum(['cash', 'card', 'digital']);

export const WaiterCallStatusSchema = z.enum(['pending', 'acknowledged', 'resolved']);

export const WaiterCallTypeSchema = z.enum([
  'assistance',
  'bill',
  'complaint',
  'question',
  'emergency',
]);

export const WaiterCallPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

export const FeedbackTypeSchema = z.enum(['complaint', 'praise']);

export const FeedbackStatusSchema = z.enum(['pending', 'acknowledged', 'resolved', 'dismissed']);

export const UserRoleSchema = z.enum(['waiter', 'admin', 'kitchen', 'owner']);

export const StockMovementTypeSchema = z.enum(['in', 'out', 'adjustment']);

export const ExpensePaymentMethodSchema = z.enum(['cash', 'card', 'digital', 'bank_transfer']);

export const WasteReasonSchema = z.enum([
  'expired',
  'spoiled',
  'overcooked',
  'dropped',
  'returned_by_customer',
  'preparation_waste',
  'other',
]);

export const TaskStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'cancelled']);

export const TaskPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

export const TaskRecurrenceSchema = z.enum(['daily', 'weekly', 'monthly']);

export const ScheduleStatusSchema = z.enum(['scheduled', 'in_progress', 'completed', 'missed']);

export const CurrencyPositionSchema = z.enum(['before', 'after']);

// ─── Table Schemas ───────────────────────────────────────────────

export const OrderSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  table_id: z.string().uuid().nullable(),
  assigned_waiter_id: z.string().uuid().nullable(),
  order_number: z.string(),
  status: OrderStatusSchema,
  source: OrderSourceSchema,
  order_type: OrderTypeSchema,
  customer_name: z.string().nullable(),
  customer_phone: z.string().nullable(),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  customer_notes: z.string().nullable(),
  internal_notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  preparing_at: z.string().nullable(),
  ready_at: z.string().nullable(),
  served_at: z.string().nullable(),
  closed_at: z.string().nullable(),
  payment_method: z.string().nullable(),
  paid_at: z.string().nullable(),
  discount_type: DiscountTypeSchema,
  discount_value: z.number(),
  discount_amount: z.number(),
  discount_reason: z.string().nullable(),
  discount_applied_by: z.string().nullable(),
  delivery_address: z.string().nullable(),
  delivery_fee: z.number(),
  delivery_notes: z.string().nullable(),
  estimated_delivery_time: z.string().nullable(),
  delivered_at: z.string().nullable(),
  delivery_person_id: z.string().uuid().nullable(),
});

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  order_id: z.string().uuid(),
  menu_item_id: z.string().uuid(),
  item_name: z.string(),
  item_price: z.number(),
  quantity: z.number().int().positive(),
  notes: z.string().nullable(),
  status: OrderItemStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export const TableSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  table_number: z.string(),
  qr_code: z.string(),
  capacity: z.number().int(),
  status: TableStatusSchema,
  location: z.string().nullable(),
  current_session_id: z.string().uuid().nullable(),
  occupied_at: z.string().nullable(),
  is_active: z.boolean(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const MenuItemSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number().positive(),
  image_url: z.string().nullable(),
  preparation_time: z.number().nullable(),
  is_popular: z.boolean(),
  is_vegetarian: z.boolean(),
  is_vegan: z.boolean(),
  is_gluten_free: z.boolean(),
  is_spicy: z.boolean(),
  allergens: z.array(z.string()).nullable(),
  is_available: z.boolean(),
  is_daily_special: z.boolean(),
  display_order: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const StaffSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string(),
  role: UserRoleSchema,
  phone: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  last_login_at: z.string().nullable(),
  auth_user_id: z.string().uuid().nullable(),
  preferred_language: z.string(),
});

export const WaiterCallSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  table_id: z.string().uuid(),
  reason: z.string(),
  call_type: WaiterCallTypeSchema,
  priority: WaiterCallPrioritySchema,
  status: WaiterCallStatusSchema,
  responded_by: z.string().uuid().nullable(),
  created_at: z.string(),
  acknowledged_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
  notes: z.string().nullable(),
});

export const CustomerFeedbackSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  table_id: z.string().uuid().nullable(),
  order_id: z.string().uuid().nullable(),
  feedback_type: FeedbackTypeSchema,
  message: z.string(),
  status: FeedbackStatusSchema,
  responded_by: z.string().uuid().nullable(),
  response: z.string().nullable(),
  created_at: z.string(),
  acknowledged_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
});

export const OrderPaymentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  order_id: z.string().uuid(),
  received_by: z.string().uuid(),
  payment_type: PaymentTypeSchema,
  amount: z.number().positive(),
  tip_amount: z.number(),
  payment_method: PaymentMethodSchema,
  order_item_ids: z.array(z.string().uuid()).nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
});

export const TableTransferSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  order_id: z.string().uuid(),
  from_table_id: z.string().uuid(),
  to_table_id: z.string().uuid(),
  transferred_by: z.string().uuid(),
  reason: z.string().nullable(),
  created_at: z.string(),
});

export const StaffScheduleSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  staff_id: z.string().uuid(),
  date: z.string(),
  planned_start: z.string(),
  planned_end: z.string(),
  actual_start: z.string().nullable(),
  actual_end: z.string().nullable(),
  status: ScheduleStatusSchema,
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const StockItemSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  quantity: z.number(),
  unit: z.string(),
  cost_price: z.number(),
  minimum_stock_level: z.number(),
  supplier_name: z.string().nullable(),
  notes: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const StockMovementSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  stock_item_id: z.string().uuid(),
  movement_type: StockMovementTypeSchema,
  quantity_change: z.number(),
  quantity_after: z.number(),
  reason: z.string().nullable(),
  performed_by: z.string().uuid().nullable(),
  created_at: z.string(),
});

export const ExpenseCategorySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export const ExpenseSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  amount: z.number().positive(),
  description: z.string(),
  payment_method: ExpensePaymentMethodSchema,
  expense_date: z.string(),
  receipt_url: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const WasteLogSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  item_name: z.string(),
  category: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
  cost_per_unit: z.number(),
  total_cost: z.number(),
  reason: WasteReasonSchema,
  stock_item_id: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  logged_by: z.string().uuid().nullable(),
  waste_date: z.string(),
  created_at: z.string(),
});

export const TaskCategorySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  icon: z.string().nullable(),
  color: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export const TaskSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  category_id: z.string().uuid().nullable(),
  priority: TaskPrioritySchema,
  status: TaskStatusSchema,
  assigned_to: z.string().uuid().nullable(),
  created_by: z.string().uuid().nullable(),
  due_date: z.string().nullable(),
  due_time: z.string().nullable(),
  completed_at: z.string().nullable(),
  is_recurring: z.boolean(),
  recurrence_pattern: TaskRecurrenceSchema.nullable(),
  recurrence_days: z.array(z.number().int()).nullable(),
  parent_task_id: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CafeSettingsSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  restaurant_name: z.string(),
  tax_enabled: z.boolean(),
  tax_percentage: z.number(),
  tax_label: z.string(),
  prices_include_tax: z.boolean(),
  show_tax_separately: z.boolean(),
  currency_symbol: z.string(),
  currency_code: z.string(),
  currency_position: CurrencyPositionSchema,
  currency_decimal_places: z.number().int(),
  minimum_order_amount: z.number(),
  allow_item_notes: z.boolean(),
  allow_order_notes: z.boolean(),
  cafe_logo_url: z.string().nullable(),
  hero_image_url: z.string().nullable(),
  brand_primary_color: z.string(),
  brand_secondary_color: z.string(),
  welcome_heading: z.string().nullable(),
  welcome_message: z.string().nullable(),
  qr_ordering_enabled: z.boolean(),
  tips_enabled: z.boolean(),
  waste_tracking_enabled: z.boolean(),
  delivery_enabled: z.boolean(),
  delivery_fee_default: z.number(),
  minimum_delivery_amount: z.number(),
  delivery_zone_info: z.string().nullable(),
  restaurant_address: z.string().nullable(),
  contact_phone: z.string().nullable(),
  contact_website: z.string().nullable(),
  social_instagram: z.string().nullable(),
  social_whatsapp: z.string().nullable(),
  social_tiktok: z.string().nullable(),
  social_telegram: z.string().nullable(),
  social_line: z.string().nullable(),
  location_maps_url: z.string().nullable(),
  default_language: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const RefundSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  order_id: z.string().uuid(),
  processed_by: z.string().uuid(),
  amount: z.number().positive(),
  reason: z.string().min(1),
  refund_method: RefundMethodSchema,
  order_item_ids: z.array(z.string().uuid()).nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
});

// ─── Inferred Types ──────────────────────────────────────────────

export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type OrderSource = z.infer<typeof OrderSourceSchema>;
export type OrderType = z.infer<typeof OrderTypeSchema>;
export type OrderItemStatus = z.infer<typeof OrderItemStatusSchema>;
export type TableStatus = z.infer<typeof TableStatusSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type PaymentType = z.infer<typeof PaymentTypeSchema>;
export type WaiterCallStatus = z.infer<typeof WaiterCallStatusSchema>;
export type WaiterCallType = z.infer<typeof WaiterCallTypeSchema>;
export type WaiterCallPriority = z.infer<typeof WaiterCallPrioritySchema>;
export type FeedbackType = z.infer<typeof FeedbackTypeSchema>;
export type FeedbackStatus = z.infer<typeof FeedbackStatusSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export type StockMovementType = z.infer<typeof StockMovementTypeSchema>;
export type ExpensePaymentMethod = z.infer<typeof ExpensePaymentMethodSchema>;
export type WasteReason = z.infer<typeof WasteReasonSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;
export type TaskRecurrence = z.infer<typeof TaskRecurrenceSchema>;
export type ScheduleStatus = z.infer<typeof ScheduleStatusSchema>;
export type CurrencyPosition = z.infer<typeof CurrencyPositionSchema>;
export type RefundMethod = z.infer<typeof RefundMethodSchema>;
