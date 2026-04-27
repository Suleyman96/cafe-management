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
import { WaiterCallTypeSchema } from './enum-schemas';

// ─── Orders INSERT ───────────────────────────────────────────────

export const OrdersRealtimeInsertSchema = z.object({
  id: z.string().uuid(),
  table_id: z.string().uuid().nullable(),
  order_number: z.string().nullable(),
});

export type OrdersRealtimeInsert = z.infer<typeof OrdersRealtimeInsertSchema>;

// ─── Waiter calls INSERT ─────────────────────────────────────────

export const WaiterCallsRealtimeInsertSchema = z.object({
  id: z.string().uuid(),
  table_id: z.string().uuid(),
  call_type: WaiterCallTypeSchema.nullable(),
});

export type WaiterCallsRealtimeInsert = z.infer<typeof WaiterCallsRealtimeInsertSchema>;
