/**
 * M5: type-level gate for the idempotency contract on "create" mutations.
 *
 * Each `*CreateInputSchema` that maps to a server endpoint with a
 * `(tenant_id, client_request_id)` dedupe index MUST require
 * `client_request_id: z.string().uuid()`. The server's unique index is
 * the actual dedupe; these client-side schemas are the type-level guard
 * that ensures the index is always exercised.
 *
 * If a future PR loosens any of these schemas (e.g. by making the field
 * `.optional()`), the `@ts-expect-error` directives below stop erroring
 * and the test fails at *type-check time* — earlier than any runtime
 * smoke could detect the regression. That's the M5 contract.
 *
 * If you add a new create-mutation schema and forget to extend this
 * file, the existing tests will still pass — but a reviewer should
 * notice the gap. Coverage by convention: every `*CreateInputSchema`
 * that's part of a `client_request_id`-dedupe path gets one entry.
 */

import { describe, expect, it } from 'vitest';
import {
  type OrderCreateInput,
  OrderCreateInputSchema,
  type OrderPaymentCreateInput,
  OrderPaymentCreateInputSchema,
  type StockAdjustInput,
  StockAdjustInputSchema,
} from '../schemas/inputs';

describe('idempotency contract (M5)', () => {
  describe('OrderCreateInput', () => {
    it('requires client_request_id at runtime via Zod', () => {
      const parsed = OrderCreateInputSchema.safeParse({
        tenant_id: '00000000-0000-0000-0000-000000000001',
        order_type: 'dine_in',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const fields = parsed.error.issues.map((i) => i.path.join('.'));
        expect(fields).toContain('client_request_id');
      }
    });

    it('accepts a UUID v4 as client_request_id', () => {
      const parsed = OrderCreateInputSchema.safeParse({
        tenant_id: '00000000-0000-0000-0000-000000000001',
        order_type: 'dine_in',
        client_request_id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
      });
      expect(parsed.success).toBe(true);
    });

    it('pins the type as required-string (compile-time gate)', () => {
      // The next line must NOT compile without `client_request_id`.
      // If a future PR makes the schema optional, this `@ts-expect-error`
      // directive stops being satisfied and TypeScript fails the build.
      // @ts-expect-error — missing required `client_request_id`
      const _missing: OrderCreateInput = {
        tenant_id: '00000000-0000-0000-0000-000000000001',
        order_type: 'dine_in',
      };
      void _missing;

      // Sanity: the same shape with the field DOES compile.
      const _ok: OrderCreateInput = {
        tenant_id: '00000000-0000-0000-0000-000000000001',
        order_type: 'dine_in',
        client_request_id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
      };
      expect(_ok.client_request_id).toBe('a47ac10b-58cc-4372-a567-0e02b2c3d479');
    });
  });

  describe('OrderPaymentCreateInput', () => {
    it('requires client_request_id at runtime via Zod', () => {
      const parsed = OrderPaymentCreateInputSchema.safeParse({
        order_id: '00000000-0000-0000-0000-000000000001',
        amount: 10,
        payment_method: 'cash',
      });
      expect(parsed.success).toBe(false);
    });

    it('pins the type as required-string (compile-time gate)', () => {
      // @ts-expect-error — missing required `client_request_id`
      const _missing: OrderPaymentCreateInput = {
        order_id: '00000000-0000-0000-0000-000000000001',
        amount: 10,
        payment_method: 'cash',
      };
      void _missing;
    });
  });

  describe('StockAdjustInput', () => {
    it('requires clientRequestId at runtime via Zod', () => {
      const parsed = StockAdjustInputSchema.safeParse({
        id: '00000000-0000-0000-0000-000000000001',
        type: 'adjustment',
        quantity: 1,
      });
      expect(parsed.success).toBe(false);
    });

    it('pins the type as required-string (compile-time gate)', () => {
      // @ts-expect-error — missing required `clientRequestId`
      const _missing: StockAdjustInput = {
        id: '00000000-0000-0000-0000-000000000001',
        type: 'adjustment',
        quantity: 1,
      };
      void _missing;
    });
  });
});
