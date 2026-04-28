/**
 * Mutation input schemas — runtime validation for user-driven payloads.
 *
 * These validate at the *call boundary* (UI → hook), not at the wire. They cover
 * fields a user can corrupt (forms, free-text inputs); fields TypeScript already
 * guarantees (system columns like id, created_at) are not validated.
 */

import { z } from 'zod';
import {
  CurrencyPositionSchema,
  OrderSourceSchema,
  OrderStatusSchema,
  OrderTypeSchema,
  PaymentMethodSchema,
  PaymentTypeSchema,
  StockMovementTypeSchema,
} from './enum-schemas';

// ─── Order create ────────────────────────────────────────────────

export const OrderCreateInputSchema = z.object({
  tenant_id: z.string().uuid(),
  order_type: OrderTypeSchema,
  source: OrderSourceSchema.optional(),
  status: OrderStatusSchema.optional(),
  table_id: z.string().uuid().nullable().optional(),
  assigned_waiter_id: z.string().uuid().nullable().optional(),
  customer_name: z.string().max(100).nullable().optional(),
  customer_phone: z.string().max(20).nullable().optional(),
  customer_notes: z.string().max(2000).nullable().optional(),
  internal_notes: z.string().max(2000).nullable().optional(),
  delivery_address: z.string().max(500).nullable().optional(),
  delivery_fee: z.number().nonnegative().optional(),
  delivery_notes: z.string().max(2000).nullable().optional(),
  estimated_delivery_time: z.string().max(50).nullable().optional(),
  subtotal: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  client_request_id: z.string().uuid().optional(),
});

export type OrderCreateInput = z.infer<typeof OrderCreateInputSchema>;

// ─── Order payment create ────────────────────────────────────────

export const OrderPaymentCreateInputSchema = z.object({
  order_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_method: PaymentMethodSchema,
  payment_type: PaymentTypeSchema.optional(),
  tip_amount: z.number().nonnegative().optional(),
  received_by: z.string().optional(),
  order_item_ids: z.array(z.string().uuid()).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  client_request_id: z.string().uuid().optional(),
});

export type OrderPaymentCreateInput = z.infer<typeof OrderPaymentCreateInputSchema>;

// ─── Stock adjustment ────────────────────────────────────────────

export const StockAdjustInputSchema = z
  .object({
    id: z.string().uuid(),
    type: StockMovementTypeSchema,
    quantity: z.number().refine((v) => v !== 0, { message: 'Quantity change must be non-zero' }),
    reason: z.string().max(255).optional(),
    performedBy: z.string().optional(),
    clientRequestId: z.string().uuid().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === 'in' && val.quantity < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Stock-in quantity must be positive',
        path: ['quantity'],
      });
    }
    if (val.type === 'out' && val.quantity > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Stock-out quantity must be negative',
        path: ['quantity'],
      });
    }
  });

export type StockAdjustInput = z.infer<typeof StockAdjustInputSchema>;

// ─── Cafe settings update ────────────────────────────────────────

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color');
const optionalUrl = z.string().url().max(2048).nullable();

export const CafeSettingsUpdateInputSchema = z
  .object({
    restaurant_name: z.string().min(1).max(100),
    tax_enabled: z.boolean(),
    tax_percentage: z.number().min(0).max(100),
    tax_label: z.string().max(50),
    prices_include_tax: z.boolean(),
    show_tax_separately: z.boolean(),
    currency_symbol: z.string().min(1).max(10),
    currency_code: z.string().min(1).max(10),
    currency_position: CurrencyPositionSchema,
    currency_decimal_places: z.number().int().min(0).max(4),
    minimum_order_amount: z.number().nonnegative(),
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
    delivery_fee_default: z.number().nonnegative(),
    minimum_delivery_amount: z.number().nonnegative(),
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
    default_language: z.string().min(2).max(10),
  })
  .partial();

export type CafeSettingsUpdateInput = z.infer<typeof CafeSettingsUpdateInputSchema>;
