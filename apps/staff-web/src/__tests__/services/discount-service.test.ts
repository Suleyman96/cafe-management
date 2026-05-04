/**
 * Discount-service guards.
 *
 * The pre-fix `applyDiscount` skipped all validation when
 * `discount_type === 'none'`, persisting whatever `discount_value` the caller
 * sent — including negative numbers. If the type was later flipped back to
 * 'fixed' without explicitly clearing the value, that stale negative would
 * activate. The clamp tests pin the contract: when type is 'none', the value
 * written to the DB is always 0 regardless of input.
 *
 * The reason-required tests pin the forensic gate: discounts at or above
 * `DISCOUNT_AUDIT_THRESHOLD` must carry a non-trivial reason. Authorization
 * itself lives at the route boundary (`verifyAdmin`); this service no
 * longer takes a `callerRole` and admin/owner is assumed.
 */

import { ValidationError } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { applyDiscount } from '@/lib/services/discount-service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const CRID = '99999999-9999-4999-8999-999999999999';

interface QueuedResponse {
  data: unknown;
  error: unknown;
}

interface CapturedUpdate {
  table: string;
  payload: Record<string, unknown>;
}

interface CapturedInsert {
  table: string;
  payload: Record<string, unknown>;
}

function buildClient(plan: Record<string, QueuedResponse[]>) {
  const cursor: Record<string, number> = {};
  const updates: CapturedUpdate[] = [];
  const inserts: CapturedInsert[] = [];

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
      for (const m of ['select', 'delete', 'eq', 'in', 'gte', 'order', 'limit']) {
        builder[m] = chain();
      }
      builder.update = (payload: Record<string, unknown>) => {
        updates.push({ table, payload });
        return builder;
      };
      builder.insert = (payload: Record<string, unknown>) => {
        inserts.push({ table, payload });
        return builder;
      };
      builder.maybeSingle = () => Promise.resolve(next(table));
      builder.single = () => Promise.resolve(next(table));
      // biome-ignore lint/suspicious/noThenProperty: required to mock the supabase builder shape
      builder.then = (resolve: (v: QueuedResponse) => unknown) => resolve(next(table));
      return builder;
    },
  } as unknown as SupabaseClient & {
    __updates: CapturedUpdate[];
    __inserts: CapturedInsert[];
  };

  (client as unknown as { __updates: CapturedUpdate[]; __inserts: CapturedInsert[] }).__updates =
    updates;
  (client as unknown as { __updates: CapturedUpdate[]; __inserts: CapturedInsert[] }).__inserts =
    inserts;
  return client;
}

describe('applyDiscount — clamps value to 0 when type is "none"', () => {
  it('persists discount_value === 0 even when caller sent a negative value', async () => {
    const client = buildClient({
      // dedupe-lookup miss — clientRequestId is now required
      financial_audit_log: [{ data: null, error: null }],
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
      clientRequestId: CRID,
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
      financial_audit_log: [{ data: null, error: null }], // dedupe lookup miss
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
      clientRequestId: CRID,
    });

    const updates = (client as unknown as { __updates: CapturedUpdate[] }).__updates;
    const orderUpdate = updates.find((u) => u.table === 'orders');
    expect(orderUpdate!.payload.discount_value).toBe(0);
  });
});

describe('applyDiscount — large-discount reason requirement', () => {
  it('rejects when fraction >= DISCOUNT_AUDIT_THRESHOLD and reason is empty', async () => {
    // Only the dedupe lookup + tenant-verification SELECT are needed —
    // the service throws before issuing the UPDATE.
    const client = buildClient({
      financial_audit_log: [{ data: null, error: null }],
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
        clientRequestId: CRID,
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
      financial_audit_log: [{ data: null, error: null }],
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
        clientRequestId: CRID,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('accepts a large discount when a sufficient reason is provided', async () => {
    const client = buildClient({
      financial_audit_log: [
        { data: null, error: null }, // dedupe lookup miss
        { data: null, error: null }, // audit INSERT
      ],
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
      clientRequestId: CRID,
    });

    expect(result.order).toMatchObject({
      discount_type: 'percentage',
      discount_value: 30,
    });
    expect(result.deduped).toBe(false);

    const updates = (client as unknown as { __updates: CapturedUpdate[] }).__updates;
    const orderUpdate = updates.find((u) => u.table === 'orders');
    expect(orderUpdate).toBeDefined();
    expect(orderUpdate!.payload.discount_type).toBe('percentage');
    expect(orderUpdate!.payload.discount_value).toBe(30);
    expect(orderUpdate!.payload.discount_reason).toBe('Customer complaint - cold food');
  });

  it('treats a 23505 unique-violation on the audit insert as a successful dedupe', async () => {
    // Concurrency scenario: replay #1 already wrote the audit row with the
    // same client_request_id. Replay #2 misses the pre-INSERT lookup (the
    // race window) and tries to insert. The partial unique index from
    // migration 20260504000002 rejects it. The service must catch 23505
    // and return deduped=true rather than surfacing a 5xx to the caller.
    const client = buildClient({
      orders: [
        // 1) tenant verification SELECT
        { data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null },
        // 2) UPDATE thenable
        { data: null, error: null },
        // 3) post-trigger fetch SELECT (returns the discount applied by the
        //    other concurrent request — UPDATE is idempotent on absolute
        //    values so the row reflects the agreed-upon state).
        {
          data: {
            id: ORDER_ID,
            subtotal: 100,
            tax: 9,
            total: 99,
            discount_type: 'percentage',
            discount_value: 10,
            discount_amount: 10,
          },
          error: null,
        },
      ],
      financial_audit_log: [
        // 1) lookup MISSES (race window — the other replay hasn't inserted yet
        //    when we read).
        { data: null, error: null },
        // 2) INSERT loses the race — the other replay's row was committed
        //    between our lookup and our insert.
        { data: null, error: { code: '23505', message: 'duplicate key value' } },
      ],
    });

    const result = await applyDiscount(client, {
      orderId: ORDER_ID,
      discountType: 'percentage',
      discountValue: 10,
      discountReason: null,
      discountAppliedBy: STAFF_ID,
      tenantId: TENANT,
      clientRequestId: 'req-concurrent-replay',
    });

    expect(result.deduped).toBe(true);
    expect(result.order).toMatchObject({
      discount_type: 'percentage',
      discount_value: 10,
    });
  });

  it('treats a non-unique-violation audit error as best-effort and still returns the order', async () => {
    // Audit log misconfiguration (RLS hiccup, table missing, etc.) must
    // not block the discount path — the discount itself is already applied.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const client = buildClient({
      orders: [
        { data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null },
        { data: null, error: null },
        {
          data: {
            id: ORDER_ID,
            subtotal: 100,
            tax: 9,
            total: 99,
            discount_type: 'percentage',
            discount_value: 10,
            discount_amount: 10,
          },
          error: null,
        },
      ],
      financial_audit_log: [
        { data: null, error: null }, // dedupe lookup miss
        // INSERT fails with a non-23505 error.
        { data: null, error: { code: '42501', message: 'permission denied' } },
      ],
    });

    const result = await applyDiscount(client, {
      orderId: ORDER_ID,
      discountType: 'percentage',
      discountValue: 10,
      discountReason: null,
      discountAppliedBy: STAFF_ID,
      tenantId: TENANT,
      clientRequestId: CRID,
    });

    expect(result.deduped).toBe(false);
    expect(result.order).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(
      '[discount-service] financial_audit_log insert failed',
      expect.objectContaining({ code: '42501' }),
    );

    warnSpy.mockRestore();
  });

  it('does not require a reason when fraction is below the threshold', async () => {
    const client = buildClient({
      financial_audit_log: [
        { data: null, error: null }, // dedupe lookup miss
        { data: null, error: null }, // audit INSERT success
      ],
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
        clientRequestId: CRID,
      }),
    ).resolves.toBeDefined();
  });

  // Blocker 1: defense-in-depth assertion at the service layer.
  it('rejects with ValidationError when no clientRequestId is supplied', async () => {
    const client = buildClient({});

    await expect(
      applyDiscount(client, {
        orderId: ORDER_ID,
        discountType: 'percentage',
        discountValue: 10,
        discountReason: null,
        discountAppliedBy: STAFF_ID,
        tenantId: TENANT,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
