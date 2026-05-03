/**
 * Discount-service clamp guard.
 *
 * The pre-fix `applyDiscount` skipped all validation when
 * `discount_type === 'none'`, persisting whatever `discount_value` the caller
 * sent — including negative numbers. If the type was later flipped back to
 * 'fixed' without explicitly clearing the value, that stale negative would
 * activate. This test pins the contract: when type is 'none', the value
 * written to the DB is always 0 regardless of input.
 */

import { ValidationError } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { applyDiscount } from '@/lib/services/discount-service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_ID = '33333333-3333-4333-8333-333333333333';

interface QueuedResponse {
  data: unknown;
  error: unknown;
}

interface CapturedUpdate {
  table: string;
  payload: Record<string, unknown>;
}

function buildClient(plan: Record<string, QueuedResponse[]>) {
  const cursor: Record<string, number> = {};
  const updates: CapturedUpdate[] = [];

  function next(table: string): QueuedResponse {
    const queue = plan[table] ?? [];
    const i = cursor[table] ?? 0;
    cursor[table] = i + 1;
    return queue[i] ?? { data: null, error: { message: `unexpected ${table}[${i}]` } };
  }

  const client = {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      const chain =
        () =>
        (..._args: unknown[]) =>
          builder;
      for (const m of ['select', 'insert', 'delete', 'eq', 'in', 'gte', 'order', 'limit']) {
        builder[m] = chain();
      }
      builder.update = (payload: Record<string, unknown>) => {
        updates.push({ table, payload });
        return builder;
      };
      builder.maybeSingle = () => Promise.resolve(next(table));
      builder.single = () => Promise.resolve(next(table));
      // biome-ignore lint/suspicious/noThenProperty: required to mock the supabase builder shape
      builder.then = (resolve: (v: QueuedResponse) => unknown) => resolve(next(table));
      return builder;
    },
  } as unknown as SupabaseClient & { __updates: CapturedUpdate[] };

  (client as unknown as { __updates: CapturedUpdate[] }).__updates = updates;
  return client;
}

describe('applyDiscount — clamps value to 0 when type is "none"', () => {
  it('persists discount_value === 0 even when caller sent a negative value', async () => {
    const client = buildClient({
      orders: [
        // 1) tenant verification SELECT
        { data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null },
        // 2) UPDATE thenable
        { data: null, error: null },
        // 3) post-trigger fetch SELECT
        {
          data: {
            id: ORDER_ID,
            subtotal: 100,
            tax: 18,
            total: 118,
            discount_type: 'none',
            discount_value: 0,
            discount_amount: 0,
          },
          error: null,
        },
      ],
    });

    await applyDiscount(client, {
      orderId: ORDER_ID,
      discountType: 'none',
      discountValue: -1000,
      discountReason: null,
      discountAppliedBy: STAFF_ID,
      tenantId: TENANT,
      callerRole: 'admin',
    });

    const updates = (client as unknown as { __updates: CapturedUpdate[] }).__updates;
    const orderUpdate = updates.find((u) => u.table === 'orders');
    expect(orderUpdate).toBeDefined();
    expect(orderUpdate!.payload.discount_type).toBe('none');
    expect(orderUpdate!.payload.discount_value).toBe(0);
  });

  it('persists discount_value === 0 even when caller sent a positive value with type "none"', async () => {
    // A clear-discount call that accidentally carries the previous value
    // must still write 0 — guards against stale-state UI bugs.
    const client = buildClient({
      orders: [
        { data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null },
        { data: null, error: null },
        {
          data: {
            id: ORDER_ID,
            subtotal: 100,
            tax: 18,
            total: 118,
            discount_type: 'none',
            discount_value: 0,
            discount_amount: 0,
          },
          error: null,
        },
      ],
    });

    await applyDiscount(client, {
      orderId: ORDER_ID,
      discountType: 'none',
      discountValue: 25,
      discountReason: null,
      discountAppliedBy: STAFF_ID,
      tenantId: TENANT,
      callerRole: 'admin',
    });

    const updates = (client as unknown as { __updates: CapturedUpdate[] }).__updates;
    const orderUpdate = updates.find((u) => u.table === 'orders');
    expect(orderUpdate!.payload.discount_value).toBe(0);
  });
});

describe('applyDiscount — large-discount reason requirement', () => {
  it('rejects when fraction >= DISCOUNT_AUDIT_THRESHOLD and reason is empty', async () => {
    // Only the tenant-verification SELECT is needed — the service should throw
    // before issuing the UPDATE.
    const client = buildClient({
      orders: [{ data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null }],
    });

    let caught: unknown;
    try {
      await applyDiscount(client, {
        orderId: ORDER_ID,
        discountType: 'percentage',
        discountValue: 30, // 30% > 20% threshold
        discountReason: '',
        discountAppliedBy: STAFF_ID,
        tenantId: TENANT,
        callerRole: 'admin',
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ValidationError);
    const err = caught as ValidationError;
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('discount_reason_required');
    expect(err.details).toMatchObject({
      fieldErrors: { discount_reason: expect.any(String) },
    });

    // No UPDATE should have been issued.
    const updates = (client as unknown as { __updates: CapturedUpdate[] }).__updates;
    expect(updates.find((u) => u.table === 'orders')).toBeUndefined();
  });

  it('rejects when reason is shorter than 5 characters (after trim)', async () => {
    const client = buildClient({
      orders: [{ data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null }],
    });

    await expect(
      applyDiscount(client, {
        orderId: ORDER_ID,
        discountType: 'fixed',
        discountValue: 50, // 50/100 = 50% > 20% threshold
        discountReason: '   ok ', // trims to 'ok' (2 chars)
        discountAppliedBy: STAFF_ID,
        tenantId: TENANT,
        callerRole: 'admin',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('accepts a large discount when a sufficient reason is provided', async () => {
    const client = buildClient({
      orders: [
        // 1) tenant verification SELECT
        { data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null },
        // 2) UPDATE thenable
        { data: null, error: null },
        // 3) post-trigger fetch SELECT
        {
          data: {
            id: ORDER_ID,
            subtotal: 100,
            tax: 18,
            total: 88,
            discount_type: 'percentage',
            discount_value: 30,
            discount_amount: 30,
          },
          error: null,
        },
      ],
    });

    const result = await applyDiscount(client, {
      orderId: ORDER_ID,
      discountType: 'percentage',
      discountValue: 30,
      discountReason: 'Customer complaint - cold food',
      discountAppliedBy: STAFF_ID,
      tenantId: TENANT,
      callerRole: 'admin',
    });

    expect(result).toMatchObject({
      discount_type: 'percentage',
      discount_value: 30,
    });

    const updates = (client as unknown as { __updates: CapturedUpdate[] }).__updates;
    const orderUpdate = updates.find((u) => u.table === 'orders');
    expect(orderUpdate).toBeDefined();
    expect(orderUpdate!.payload.discount_type).toBe('percentage');
    expect(orderUpdate!.payload.discount_value).toBe(30);
    expect(orderUpdate!.payload.discount_reason).toBe('Customer complaint - cold food');
  });

  it('does not require a reason when fraction is below the threshold', async () => {
    const client = buildClient({
      orders: [
        { data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null },
        { data: null, error: null },
        {
          data: {
            id: ORDER_ID,
            subtotal: 100,
            tax: 18,
            total: 108,
            discount_type: 'percentage',
            discount_value: 10,
            discount_amount: 10,
          },
          error: null,
        },
      ],
    });

    await expect(
      applyDiscount(client, {
        orderId: ORDER_ID,
        discountType: 'percentage',
        discountValue: 10, // 10% < 20% threshold — no reason needed
        discountReason: null,
        discountAppliedBy: STAFF_ID,
        tenantId: TENANT,
        callerRole: 'waiter',
      }),
    ).resolves.toBeDefined();
  });
});
