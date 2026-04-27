/**
 * Enum Zod schemas — extracted into their own file so both the Row schemas
 * (./index.ts) and the input schemas (./inputs.ts) can import without
 * creating a circular dependency between siblings.
 */

import { z } from 'zod';

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
