/**
 * Dedupe-coverage tests for mutation routes that accept `client_request_id`.
 *
 * Mobile persists mutations via TanStack Query persister + retries them on
 * relaunch. If the original commit succeeded but the response was lost, the
 * replay must NOT create a duplicate side-effect row (payment, refund, stock
 * movement, audit log entry, …). Each covered service short-circuits when
 * the dedupe anchor is already present and returns the prior result.
 *
 * For the discount path the dedupe anchor is the
 * `financial_audit_log.details.client_request_id` JSON field; the discount
 * UPDATE itself is idempotent on absolute values, so the audit-log entry is
 * the only side effect that must run at most once.
 */

import { ValidationError } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyDiscount } from '@/lib/services/discount-service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const CLIENT_REQUEST_ID = '44444444-4444-4444-8444-444444444444';

interface QueuedResponse {
  data: unknown;
  error: unknown;
}

function buildClient(plan: Record<string, QueuedResponse[]>) {
  const cursor: Record<string, number> = {};
  const inserts: Array<{ table: string; payload: Record<string, unknown> }> = [];
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];

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
  } as unknown as SupabaseClient;

  return { client, inserts, updates };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('discount-service — dedupe via financial_audit_log.client_request_id', () => {
  it('first call applies discount and writes audit log with client_request_id stamped', async () => {
    const { client, inserts, updates } = buildClient({
      // 1) lookup audit_log → no prior row
      financial_audit_log: [
        { data: null, error: null },
        // 2) audit insert thenable
        { data: null, error: null },
      ],
      orders: [
        // tenant verification SELECT
        { data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null },
        // UPDATE thenable
        { data: null, error: null },
        // post-trigger fetch SELECT
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

    const result = await applyDiscount(client, {
      orderId: ORDER_ID,
      discountType: 'percentage',
      discountValue: 10,
      discountReason: null,
      discountAppliedBy: STAFF_ID,
      clientRequestId: CLIENT_REQUEST_ID,
      tenantId: TENANT,
    });

    expect(result.deduped).toBe(false);
    expect(updates.find((u) => u.table === 'orders')).toBeDefined();
    const auditInsert = inserts.find((i) => i.table === 'financial_audit_log');
    expect(auditInsert).toBeDefined();
    const details = auditInsert!.payload.details as Record<string, unknown>;
    expect(details.client_request_id).toBe(CLIENT_REQUEST_ID);
  });

  it('replayed call short-circuits — no UPDATE, no audit insert, returns deduped=true', async () => {
    const { client, inserts, updates } = buildClient({
      // lookup audit_log returns the prior row
      financial_audit_log: [
        {
          data: { id: 'audit-1' },
          error: null,
        },
      ],
      // The replay path calls fetchOrder() which hits orders.single() once.
      orders: [
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

    const result = await applyDiscount(client, {
      orderId: ORDER_ID,
      discountType: 'percentage',
      discountValue: 10,
      discountReason: null,
      discountAppliedBy: STAFF_ID,
      clientRequestId: CLIENT_REQUEST_ID,
      tenantId: TENANT,
    });

    expect(result.deduped).toBe(true);
    expect(result.order).toMatchObject({ id: ORDER_ID, discount_value: 10 });
    // No second audit log row, no second UPDATE.
    expect(updates.find((u) => u.table === 'orders')).toBeUndefined();
    expect(inserts.find((i) => i.table === 'financial_audit_log')).toBeUndefined();
  });

  it('omitting client_request_id rejects with ValidationError (Blocker 1)', async () => {
    // Pre-Blocker-1 the service quietly skipped dedupe when no key was
    // supplied. Now the call MUST carry a key — discounts are
    // financial-audit-log-anchored and a missing key is a programmer
    // error, not a fallback. The route schema also rejects, but we keep
    // a unit assertion at the service layer for defense-in-depth.
    const { client } = buildClient({
      orders: [{ data: { id: ORDER_ID, subtotal: 100, tenant_id: TENANT }, error: null }],
    });

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
