/**
 * Realtime payload schemas — runtime validation for Supabase Realtime
 * `postgres_changes` payloads.
 *
 * These validate the `payload.new` shape passed to subscription callbacks.
 * Realtime sends raw row data over the wire as plain JSON, so TypeScript's
 * Row types are a *claim* about that shape — not a guarantee. Validate before
 * reading fields, especially when the value flows into a side effect
 * (sound, push notification, alert).
 *
 * Schemas are intentionally narrow: they only validate the fields the
 * subscription handler actually reads. Adding fields the handler ignores
 * would couple this schema to the database row shape and create churn on
 * every column addition.
 */

import { z } from 'zod';
import {
  OrderItemStatusSchema,
  OrderStatusSchema,
  WaiterCallStatusSchema,
  WaiterCallTypeSchema,
} from './enum-schemas';

// ─── Orders INSERT ───────────────────────────────────────────────

export const OrdersRealtimeInsertSchema = z.object({
  id: z.string().uuid(),
  table_id: z.string().uuid().nullable(),
  order_number: z.string().nullable(),
});

export type OrdersRealtimeInsert = z.infer<typeof OrdersRealtimeInsertSchema>;

// ─── Orders UPDATE ───────────────────────────────────────────────

export const OrdersRealtimeUpdateSchema = z.object({
  id: z.string().uuid(),
  status: OrderStatusSchema.nullable(),
  table_id: z.string().uuid().nullable(),
  updated_at: z.string().datetime({ offset: true }).nullable(),
});

export type OrdersRealtimeUpdatePayload = z.infer<typeof OrdersRealtimeUpdateSchema>;

// ─── Order items UPDATE ──────────────────────────────────────────
//
// Audit C5 — `order_items` UPDATE events fire frequently during a busy
// service (every status transition: pending → preparing → ready → served).
// The `useOrders` hook patches the cache from this payload directly
// instead of invalidating the orders list, so the kitchen view doesn't
// re-fetch on every status flip. Only the fields the patch reads are
// validated; the spread keeps any extra columns (timestamps, notes) on
// the cached row.

export const OrderItemsRealtimeUpdateSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  status: OrderItemStatusSchema.nullable().optional(),
});

export type OrderItemsRealtimeUpdatePayload = z.infer<typeof OrderItemsRealtimeUpdateSchema>;

// ─── Waiter calls INSERT ─────────────────────────────────────────

export const WaiterCallsRealtimeInsertSchema = z.object({
  id: z.string().uuid(),
  table_id: z.string().uuid(),
  call_type: WaiterCallTypeSchema.nullable(),
});

export type WaiterCallsRealtimeInsert = z.infer<typeof WaiterCallsRealtimeInsertSchema>;

// ─── Waiter calls UPDATE ─────────────────────────────────────────

export const WaiterCallsRealtimeUpdateSchema = z.object({
  id: z.string().uuid(),
  status: WaiterCallStatusSchema.nullable(),
  resolved_at: z.string().datetime({ offset: true }).nullable(),
});

export type WaiterCallsRealtimeUpdatePayload = z.infer<typeof WaiterCallsRealtimeUpdateSchema>;
