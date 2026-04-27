/**
 * Zod schemas for runtime validation
 *
 * Each schema mirrors the corresponding database table Row type.
 * Enum schemas live in ./enum-schemas so input schemas can share them
 * without a circular sibling-import.
 */

import { z } from 'zod';
import {
  CurrencyPositionSchema,
  DiscountTypeSchema,
  ExpensePaymentMethodSchema,
  FeedbackStatusSchema,
  FeedbackTypeSchema,
  OrderItemStatusSchema,
  OrderSourceSchema,
  OrderStatusSchema,
  OrderTypeSchema,
  PaymentMethodSchema,
  PaymentTypeSchema,
  RefundMethodSchema,
  ScheduleStatusSchema,
  StockMovementTypeSchema,
  TableStatusSchema,
  TaskPrioritySchema,
  TaskRecurrenceSchema,
  TaskStatusSchema,
  UserRoleSchema,
  WaiterCallPrioritySchema,
  WaiterCallStatusSchema,
  WaiterCallTypeSchema,
  WasteReasonSchema,
} from './enum-schemas';

// Re-export enum schemas so existing consumers of `@gustri/database` keep working.
export * from './enum-schemas';

// ─── Reusable Field Schemas ─────────────────────────────────────

const optionalUrl = z.string().url().max(2048).nullable();
const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color')
  .max(7);

// ─── Table Schemas ───────────────────────────────────────────────

export const OrderSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  table_id: z.string().uuid().nullable(),
  assigned_waiter_id: z.string().uuid().nullable(),
  order_number: z.string().max(50),
  status: OrderStatusSchema,
  source: OrderSourceSchema,
  order_type: OrderTypeSchema,
  customer_name: z.string().max(100).nullable(),
  customer_phone: z.string().max(20).nullable(),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  customer_notes: z.string().max(2000).nullable(),
  internal_notes: z.string().max(2000).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  preparing_at: z.string().nullable(),
  ready_at: z.string().nullable(),
  served_at: z.string().nullable(),
  closed_at: z.string().nullable(),
  payment_method: z.string().max(50).nullable(),
  paid_at: z.string().nullable(),
  discount_type: DiscountTypeSchema,
  discount_value: z.number(),
  discount_amount: z.number(),
  discount_reason: z.string().max(255).nullable(),
  discount_applied_by: z.string().max(100).nullable(),
  delivery_address: z.string().max(500).nullable(),
  delivery_fee: z.number(),
  delivery_notes: z.string().max(2000).nullable(),
  estimated_delivery_time: z.string().max(50).nullable(),
  delivered_at: z.string().nullable(),
  delivery_person_id: z.string().uuid().nullable(),
  delivery_access_token: z.string().nullable(),
});

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  order_id: z.string().uuid(),
  menu_item_id: z.string().uuid(),
  item_name: z.string().max(100),
  item_price: z.number(),
  quantity: z.number().int().positive(),
  notes: z.string().max(500).nullable(),
  status: OrderItemStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export const TableSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  table_number: z.string().max(50),
  qr_code: z.string().max(255),
  capacity: z.number().int(),
  status: TableStatusSchema,
  location: z.string().max(100).nullable(),
  current_session_id: z.string().uuid().nullable(),
  occupied_at: z.string().nullable(),
  is_active: z.boolean(),
  notes: z.string().max(500).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const MenuItemSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  name: z.string().max(100),
  description: z.string().max(2000).nullable(),
  price: z.number().nonnegative(),
  image_url: optionalUrl,
  preparation_time: z.number().nullable(),
  is_popular: z.boolean(),
  is_vegetarian: z.boolean(),
  is_vegan: z.boolean(),
  is_gluten_free: z.boolean(),
  is_spicy: z.boolean(),
  allergens: z.array(z.string().max(50)).nullable(),
  is_available: z.boolean(),
  is_daily_special: z.boolean(),
  display_order: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const StaffSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  email: z.string().email().max(255),
  full_name: z.string().max(100),
  role: UserRoleSchema,
  phone: z.string().max(20).nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  last_login_at: z.string().nullable(),
  auth_user_id: z.string().uuid().nullable(),
  preferred_language: z.string().max(10),
  push_token: z.string().nullable(),
});

export const WaiterCallSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  table_id: z.string().uuid(),
  reason: z.string().max(500),
  call_type: WaiterCallTypeSchema,
  priority: WaiterCallPrioritySchema,
  status: WaiterCallStatusSchema,
  responded_by: z.string().uuid().nullable(),
  created_at: z.string(),
  acknowledged_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
  notes: z.string().max(1000).nullable(),
});

export const CustomerFeedbackSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  table_id: z.string().uuid().nullable(),
  order_id: z.string().uuid().nullable(),
  feedback_type: FeedbackTypeSchema,
  message: z.string().max(2000),
  status: FeedbackStatusSchema,
  responded_by: z.string().uuid().nullable(),
  response: z.string().max(2000).nullable(),
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
  notes: z.string().max(500).nullable(),
  created_at: z.string(),
});

export const TableTransferSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  order_id: z.string().uuid(),
  from_table_id: z.string().uuid(),
  to_table_id: z.string().uuid(),
  transferred_by: z.string().uuid(),
  reason: z.string().max(255).nullable(),
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
  notes: z.string().max(500).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const StockItemSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().max(100),
  description: z.string().max(500).nullable(),
  category: z.string().max(100),
  quantity: z.number(),
  unit: z.string().max(50),
  cost_price: z.number(),
  minimum_stock_level: z.number(),
  supplier_name: z.string().max(100).nullable(),
  notes: z.string().max(1000).nullable(),
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
  reason: z.string().max(255).nullable(),
  performed_by: z.string().uuid().nullable(),
  created_at: z.string(),
});

export const ExpenseCategorySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().max(100),
  description: z.string().max(500).nullable(),
  icon: z.string().max(50).nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export const ExpenseSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  amount: z.number().positive(),
  description: z.string().max(500),
  payment_method: ExpensePaymentMethodSchema,
  expense_date: z.string(),
  receipt_url: optionalUrl,
  created_by: z.string().uuid().nullable(),
  notes: z.string().max(1000).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const WasteLogSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  item_name: z.string().max(100),
  category: z.string().max(100),
  quantity: z.number().positive(),
  unit: z.string().max(50),
  cost_per_unit: z.number(),
  total_cost: z.number(),
  reason: WasteReasonSchema,
  stock_item_id: z.string().uuid().nullable(),
  notes: z.string().max(1000).nullable(),
  logged_by: z.string().uuid().nullable(),
  waste_date: z.string(),
  created_at: z.string(),
});

export const TaskCategorySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().max(100),
  icon: z.string().max(50).nullable(),
  color: hexColor,
  is_active: z.boolean(),
  created_at: z.string(),
});

export const TaskSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  title: z.string().max(200),
  description: z.string().max(2000).nullable(),
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
  notes: z.string().max(1000).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CafeSettingsSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  restaurant_name: z.string().max(100),
  tax_enabled: z.boolean(),
  tax_percentage: z.number(),
  tax_label: z.string().max(50),
  prices_include_tax: z.boolean(),
  show_tax_separately: z.boolean(),
  currency_symbol: z.string().max(10),
  currency_code: z.string().max(10),
  currency_position: CurrencyPositionSchema,
  currency_decimal_places: z.number().int(),
  minimum_order_amount: z.number(),
  allow_item_notes: z.boolean(),
  allow_order_notes: z.boolean(),
  cafe_logo_url: optionalUrl,
  hero_image_url: optionalUrl,
  brand_primary_color: hexColor,
  brand_secondary_color: hexColor,
  welcome_heading: z.string().max(200).nullable(),
  welcome_message: z.string().max(1000).nullable(),
  qr_ordering_enabled: z.boolean(),
  tips_enabled: z.boolean(),
  waste_tracking_enabled: z.boolean(),
  delivery_enabled: z.boolean(),
  delivery_fee_default: z.number(),
  minimum_delivery_amount: z.number(),
  delivery_zone_info: z.string().max(2000).nullable(),
  restaurant_address: z.string().max(500).nullable(),
  contact_phone: z.string().max(20).nullable(),
  contact_website: optionalUrl,
  social_instagram: z.string().max(255).nullable(),
  social_whatsapp: z.string().max(20).nullable(),
  social_tiktok: z.string().max(255).nullable(),
  social_telegram: z.string().max(255).nullable(),
  social_line: z.string().max(255).nullable(),
  location_maps_url: optionalUrl,
  default_language: z.string().max(10),
  created_at: z.string(),
  updated_at: z.string(),
});

export const RefundSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  order_id: z.string().uuid(),
  processed_by: z.string().uuid(),
  amount: z.number().positive(),
  reason: z.string().min(1).max(500),
  refund_method: RefundMethodSchema,
  order_item_ids: z.array(z.string().uuid()).nullable(),
  notes: z.string().max(1000).nullable(),
  created_at: z.string(),
});

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  plan: z.enum(['free', 'standard', 'pro', 'business']),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CategorySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  display_order: z.number().int(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const DeliveryCustomerSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  phone: z.string(),
  address: z.string(),
  notes: z.string().nullable(),
  order_count: z.number().int(),
  last_order_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
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
// Table schema inferred types
export type OrderInput = z.infer<typeof OrderSchema>;
export type OrderItemInput = z.infer<typeof OrderItemSchema>;
export type TableInput = z.infer<typeof TableSchema>;
export type MenuItemInput = z.infer<typeof MenuItemSchema>;
export type StaffInput = z.infer<typeof StaffSchema>;
export type WaiterCallInput = z.infer<typeof WaiterCallSchema>;
export type CustomerFeedbackInput = z.infer<typeof CustomerFeedbackSchema>;
export type OrderPaymentInput = z.infer<typeof OrderPaymentSchema>;
export type TableTransferInput = z.infer<typeof TableTransferSchema>;
export type StaffScheduleInput = z.infer<typeof StaffScheduleSchema>;
export type StockItemInput = z.infer<typeof StockItemSchema>;
export type StockMovementInput = z.infer<typeof StockMovementSchema>;
export type ExpenseCategoryInput = z.infer<typeof ExpenseCategorySchema>;
export type ExpenseInput = z.infer<typeof ExpenseSchema>;
export type WasteLogInput = z.infer<typeof WasteLogSchema>;
export type TaskCategoryInput = z.infer<typeof TaskCategorySchema>;
export type TaskInput = z.infer<typeof TaskSchema>;
export type CafeSettingsInput = z.infer<typeof CafeSettingsSchema>;
export type RefundInput = z.infer<typeof RefundSchema>;
export type DeliveryCustomerInput = z.infer<typeof DeliveryCustomerSchema>;
export type TenantInput = z.infer<typeof TenantSchema>;
export type CategoryInput = z.infer<typeof CategorySchema>;

// ─── Force-Update Gate Schemas ───────────────────────────────────
export * from './app-version';
// ─── Mutation Input Schemas ──────────────────────────────────────
export * from './inputs';
// ─── Realtime Payload Schemas ────────────────────────────────────
export * from './realtime';
