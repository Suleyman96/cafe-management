/**
 * Mutation input schemas — runtime validation for user-driven payloads.
 *
 * These validate at the *call boundary* (UI → hook), not at the wire. They cover
 * fields a user can corrupt (forms, free-text inputs); fields TypeScript already
 * guarantees (system columns like id, created_at) are not validated.
 */

import { z } from 'zod';
import { isValidPhone } from '../validators';
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
  // Phone must be callable (≥7 real digits), matching the server route's
  // `delivery_phone` refine — so the client and server reject the same garbage
  // (`+()()()` etc.). null/undefined still pass (phone is optional).
  customer_phone: z
    .string()
    .max(20)
    .refine(isValidPhone, 'invalid_phone_format')
    .nullable()
    .optional(),
  customer_notes: z.string().max(2000).nullable().optional(),
  internal_notes: z.string().max(2000).nullable().optional(),
  delivery_address: z.string().max(500).nullable().optional(),
  delivery_fee: z.number().nonnegative().optional(),
  delivery_notes: z.string().max(2000).nullable().optional(),
  estimated_delivery_time: z.string().max(50).nullable().optional(),
  // subtotal/tax/total are intentionally NOT validated here — they are
  // derived server-side. The order is inserted with zeros and the
  // `recalculate_on_item_insert` trigger on `order_items` rewrites them
  // when items land. Anything a client sends in these fields is ignored.
  // Required (Blocker 1, pre-release audit): every order create must
  // carry a UUID v4 idempotency key so a retried POST hits the server
  // dedupe path instead of producing duplicate kitchen tickets.
  client_request_id: z.string().uuid(),
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
  // Required (Blocker 1): payments are the highest-risk replay path —
  // a missing key would let a network-retried POST double-charge.
  client_request_id: z.string().uuid(),
});

export type OrderPaymentCreateInput = z.infer<typeof OrderPaymentCreateInputSchema>;

// ─── Refund create ───────────────────────────────────────────────

// Refunds move money out — validate the amount can't be negative, zero,
// NaN or Infinity at the call boundary (defense-in-depth on top of the
// server's `validate_refund_amount` trigger). `reason` is required and
// capped; `client_request_id` dedupes a network-retried refund against the
// server's (tenant_id, client_request_id) partial unique index.
export const RefundCreateInputSchema = z.object({
  order_id: z.string().min(1),
  processed_by: z.string().min(1),
  amount: z.number().finite().positive(),
  reason: z.string().min(1).max(500),
  refund_method: PaymentMethodSchema,
  order_item_ids: z.array(z.string()).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  client_request_id: z.string().uuid(),
});

export type RefundCreateInput = z.infer<typeof RefundCreateInputSchema>;

// ─── Discount apply ──────────────────────────────────────────────

// Field names mirror the staff-web `useApplyDiscount` hook input
// (`orderId` camelCase, the rest snake_case). A discount changes the order
// total, so a corrupt value (negative / NaN / >100% percentage) would
// mis-state revenue. Rules:
//   - `discount_value` must be finite and non-negative.
//   - For `percentage`/`fixed` discounts the value must be > 0 (a real
//     discount) and, for `percentage`, ≤ 100.
//   - `none` is the "clear discount" path — value 0 is expected there.
export const DiscountApplyInputSchema = z
  .object({
    orderId: z.string().min(1),
    discount_type: z.enum(['none', 'percentage', 'fixed']),
    discount_value: z.number().finite().nonnegative(),
    discount_reason: z.string().max(500).nullable().optional(),
    discount_applied_by: z.string().min(1),
    client_request_id: z.string().uuid(),
  })
  .superRefine((val, ctx) => {
    if (val.discount_type !== 'none' && !(val.discount_value > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Discount value must be greater than zero',
        path: ['discount_value'],
      });
    }
    if (val.discount_type === 'percentage' && val.discount_value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Percentage discount cannot exceed 100',
        path: ['discount_value'],
      });
    }
  });

export type DiscountApplyInput = z.infer<typeof DiscountApplyInputSchema>;

// ─── Stock adjustment ────────────────────────────────────────────

export const StockAdjustInputSchema = z
  .object({
    id: z.string().uuid(),
    type: StockMovementTypeSchema,
    quantity: z.number().refine((v) => v !== 0, { message: 'Quantity change must be non-zero' }),
    reason: z.string().max(255).optional(),
    performedBy: z.string().optional(),
    // Required (Blocker 1): stock movements must dedupe on replay so a
    // retried adjustment doesn't double-deduct inventory.
    clientRequestId: z.string().uuid(),
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

// ─── Staff kitchen filters replace ───────────────────────────────

// Replace = atomic delete-then-insert. Empty array means "show all" (the
// kitchen view interprets the absence of rows as no filter). The wrapper
// derives tenant_id from auth context, so callers pass only the staff_id
// and category list. Cap at 64 — no realistic restaurant has more than
// a few dozen kitchen-relevant categories, and the cap defends against
// pathological payloads.
export const StaffKitchenFiltersReplaceInputSchema = z.object({
  staff_id: z.string().uuid(),
  category_ids: z.array(z.string().uuid()).max(64),
});

export type StaffKitchenFiltersReplaceInput = z.infer<typeof StaffKitchenFiltersReplaceInputSchema>;
