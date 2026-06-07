/**
 * Input-schema runtime validation — the customer_phone refine.
 *
 * `OrderCreateInputSchema.customer_phone` now runs `isValidPhone` (relocated
 * from @gustri/core into this package so the schema can reuse it without a
 * dependency cycle), matching the server route's `delivery_phone` strictness so
 * client and server reject the same garbage.
 */

import { describe, expect, it } from 'vitest';
import { OrderCreateInputSchema } from '../schemas/inputs';

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
