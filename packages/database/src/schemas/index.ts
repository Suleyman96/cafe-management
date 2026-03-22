/**
 * Zod schemas for runtime validation
 */

import { z } from 'zod';

// Order schemas
export const OrderStatusSchema = z.enum([
  'new',
  'pending_approval',
  'preparing',
  'ready',
  'served',
  'paid',
  'cancelled',
]);
export const OrderSourceSchema = z.enum(['customer', 'waiter', 'phone']);

export const OrderSchema = z.object({
  id: z.string().uuid(),
  status: OrderStatusSchema,
  source: OrderSourceSchema,
  table_id: z.string().uuid().nullable(),
  customer_name: z.string().nullable(),
  customer_phone: z.string().nullable(),
  staff_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Table schemas
export const TableStatusSchema = z.enum(['free', 'occupied', 'reserved', 'closed']);

export const TableSchema = z.object({
  id: z.string().uuid(),
  table_number: z.number(),
  qr_code: z.string(),
  capacity: z.number(),
  status: TableStatusSchema,
  location: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Menu item schemas
export const MenuItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number().positive(),
  category_id: z.string().uuid(),
  image_url: z.string().nullable(),
  is_available: z.boolean(),
  is_vegetarian: z.boolean(),
  is_vegan: z.boolean(),
  is_gluten_free: z.boolean(),
  is_spicy: z.boolean(),
  is_popular: z.boolean(),
  is_daily_special: z.boolean(),
  allergens: z.array(z.string()),
  display_order: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Stock item schema
export const StockMovementTypeSchema = z.enum(['in', 'out', 'adjustment']);

export const StockItemSchema = z.object({
  id: z.string().uuid(),
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

// Expense schema
export const ExpensePaymentMethodSchema = z.enum(['cash', 'card', 'digital', 'bank_transfer']);

export const ExpenseSchema = z.object({
  id: z.string().uuid(),
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

export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type OrderSource = z.infer<typeof OrderSourceSchema>;
export type TableStatus = z.infer<typeof TableStatusSchema>;
export type StockMovementType = z.infer<typeof StockMovementTypeSchema>;
export type ExpensePaymentMethod = z.infer<typeof ExpensePaymentMethodSchema>;
