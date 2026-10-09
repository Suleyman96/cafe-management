/**
 * Input-schema runtime validation — the customer_phone refine.
 *
 * `OrderCreateInputSchema.customer_phone` now runs `isValidPhone` (relocated
 * from @gustri/core into this package so the schema can reuse it without a
 * dependency cycle), matching the server route's `delivery_phone` strictness so
 * client and server reject the same garbage.
 */

import { describe, expect, it } from 'vitest';
import {
  DiscountApplyInputSchema,
  OrderCreateInputSchema,
  RefundCreateInputSchema,
} from '../schemas/inputs';

const base = {
  tenant_id: '00000000-0000-0000-0000-000000000001',
  order_type: 'takeout' as const,
  client_request_id: '11111111-1111-4111-8111-111111111111',
};

describe('OrderCreateInputSchema — customer_phone', () => {
  it('accepts a callable phone', () => {
    expect(
      OrderCreateInputSchema.safeParse({ ...base, customer_phone: '+1 555 123 4567' }).success,
    ).toBe(true);
  });

  it('accepts null or omitted (phone is optional)', () => {
    expect(OrderCreateInputSchema.safeParse({ ...base, customer_phone: null }).success).toBe(true);
    expect(OrderCreateInputSchema.safeParse(base).success).toBe(true);
  });

  it('rejects shape-valid but uncallable garbage (no real digits)', () => {
    expect(OrderCreateInputSchema.safeParse({ ...base, customer_phone: '+()()()()' }).success).toBe(
      false,
    );
  });

  it('rejects a value with too few digits', () => {
    expect(OrderCreateInputSchema.safeParse({ ...base, customer_phone: '12345' }).success).toBe(
      false,
    );
  });
});

// ─── M5: Refund create ───────────────────────────────────────────

describe('RefundCreateInputSchema — amount validation', () => {
  const refundBase = {
    order_id: '00000000-0000-0000-0000-000000000001',
    processed_by: '00000000-0000-0000-0000-000000000002',
    reason: 'Customer returned dish',
    refund_method: 'cash' as const,
    client_request_id: '11111111-1111-4111-8111-111111111111',
  };

  it('accepts a positive finite amount', () => {
    expect(RefundCreateInputSchema.safeParse({ ...refundBase, amount: 12.5 }).success).toBe(true);
  });

  it('rejects a negative amount', () => {
    expect(RefundCreateInputSchema.safeParse({ ...refundBase, amount: -5 }).success).toBe(false);
  });

  it('rejects a zero amount', () => {
    expect(RefundCreateInputSchema.safeParse({ ...refundBase, amount: 0 }).success).toBe(false);
  });

  it('rejects NaN and Infinity', () => {
    expect(RefundCreateInputSchema.safeParse({ ...refundBase, amount: Number.NaN }).success).toBe(
      false,
    );
    expect(
      RefundCreateInputSchema.safeParse({ ...refundBase, amount: Number.POSITIVE_INFINITY })
        .success,
    ).toBe(false);
  });

  it('rejects an empty reason and an over-long reason', () => {
    expect(
      RefundCreateInputSchema.safeParse({ ...refundBase, amount: 5, reason: '' }).success,
    ).toBe(false);
    expect(
      RefundCreateInputSchema.safeParse({ ...refundBase, amount: 5, reason: 'x'.repeat(501) })
        .success,
    ).toBe(false);
  });

  it('rejects a non-uuid client_request_id', () => {
    expect(
      RefundCreateInputSchema.safeParse({ ...refundBase, amount: 5, client_request_id: 'nope' })
        .success,
    ).toBe(false);
  });
});

// ─── M5: Discount apply ──────────────────────────────────────────

describe('DiscountApplyInputSchema — value validation', () => {
  const discountBase = {
    orderId: '00000000-0000-0000-0000-000000000001',
    discount_applied_by: '00000000-0000-0000-0000-000000000002',
    client_request_id: '11111111-1111-4111-8111-111111111111',
  };

  it('accepts a valid fixed discount', () => {
    expect(
      DiscountApplyInputSchema.safeParse({
        ...discountBase,
        discount_type: 'fixed',
        discount_value: 10,
      }).success,
    ).toBe(true);
  });

  it('accepts a percentage of exactly 100', () => {
    expect(
      DiscountApplyInputSchema.safeParse({
        ...discountBase,
        discount_type: 'percentage',
        discount_value: 100,
      }).success,
    ).toBe(true);
  });

  it('rejects a percentage above 100', () => {
    expect(
      DiscountApplyInputSchema.safeParse({
        ...discountBase,
        discount_type: 'percentage',
        discount_value: 101,
      }).success,
    ).toBe(false);
  });

  it('rejects negative and NaN values', () => {
    expect(
      DiscountApplyInputSchema.safeParse({
        ...discountBase,
        discount_type: 'fixed',
        discount_value: -1,
      }).success,
    ).toBe(false);
    expect(
      DiscountApplyInputSchema.safeParse({
        ...discountBase,
        discount_type: 'fixed',
        discount_value: Number.NaN,
      }).success,
    ).toBe(false);
  });

  it('rejects a zero value for a real (non-none) discount', () => {
    expect(
      DiscountApplyInputSchema.safeParse({
        ...discountBase,
        discount_type: 'percentage',
        discount_value: 0,
      }).success,
    ).toBe(false);
  });

  it('allows value 0 for the "none" clear-discount path', () => {
    expect(
      DiscountApplyInputSchema.safeParse({
        ...discountBase,
        discount_type: 'none',
        discount_value: 0,
      }).success,
    ).toBe(true);
  });
});
