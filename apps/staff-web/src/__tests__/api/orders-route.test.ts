/**
 * Route-level test for `/api/v1/orders` (C2 — server-side totals).
 *
 * The pre-fix schema accepted `subtotal`, `tax`, `total` from the request
 * body and persisted them verbatim. A staffer could POST real items with
 * `total: 0.01` and pocket the cash difference at the till. The fix is to
 * strip those fields at the schema boundary so they never reach the
 * service. This test pins the contract: the body shape passed downstream
 * must NOT carry totals, no matter what the client sends.
 */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/verify-admin', () => ({
  getSupabaseAdmin: () => ({}),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 999, resetAt: 0 }),
  getRateLimitIdentifier: () => '127.0.0.1',
}));

vi.mock('@/lib/api/verify-staff', () => ({
  verifyStaff: vi.fn().mockResolvedValue({
    id: 'staff-1',
    role: 'waiter',
    tenant_id: '11111111-1111-4111-8111-111111111111',
  }),
}));

const createOrderMock = vi.fn();
vi.mock('@/lib/services/order-service', () => ({
  createOrder: (...args: unknown[]) => createOrderMock(...args),
}));

const { POST } = await import('@/app/api/v1/orders/route');

function buildRequest(body: Record<string, unknown>): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as unknown as NextRequest;
}

beforeEach(() => {
  createOrderMock.mockReset();
  createOrderMock.mockResolvedValue({
    order: { id: 'o1', tenant_id: '11111111-1111-4111-8111-111111111111' },
    deduped: false,
  });
});

const CRID = '33333333-3333-4333-8333-333333333333';

describe('POST /api/v1/orders — totals are stripped (C2)', () => {
  it('strips subtotal/tax/total from a takeout payload before reaching the service', async () => {
    // Attacker-shaped body: real items would be added later but the order
    // is opened with bogus totals to fool downstream receipts. Schema must
    // drop the three fields entirely.
    const res = await POST(
      buildRequest({
        order_type: 'takeout',
        customer_name: 'Mallory',
        customer_phone: '+15550001111',
        subtotal: 0.01,
        tax: 0,
        total: 0.01,
        client_request_id: CRID,
      }),
    );

    expect(res.status).toBe(201);
    expect(createOrderMock).toHaveBeenCalledTimes(1);
    const callArg = createOrderMock.mock.calls[0]![1] as {
      orderData: Record<string, unknown>;
    };
    expect(callArg.orderData).not.toHaveProperty('subtotal');
    expect(callArg.orderData).not.toHaveProperty('tax');
    expect(callArg.orderData).not.toHaveProperty('total');
    expect(callArg.orderData.order_type).toBe('takeout');
  });

  it('accepts a body with no totals at all (the normal client flow)', async () => {
    const res = await POST(
      buildRequest({
        order_type: 'dine_in',
        table_id: '22222222-2222-4222-8222-222222222222',
        client_request_id: CRID,
      }),
    );

    expect(res.status).toBe(201);
    expect(createOrderMock).toHaveBeenCalledTimes(1);
    const callArg = createOrderMock.mock.calls[0]![1] as {
      orderData: Record<string, unknown>;
    };
    expect(callArg.orderData).not.toHaveProperty('subtotal');
    expect(callArg.orderData).not.toHaveProperty('tax');
    expect(callArg.orderData).not.toHaveProperty('total');
  });

  it('rejects with 400 when client_request_id is missing (Blocker 1)', async () => {
    const res = await POST(
      buildRequest({
        order_type: 'dine_in',
        table_id: '22222222-2222-4222-8222-222222222222',
      }),
    );

    expect(res.status).toBe(400);
    expect(createOrderMock).not.toHaveBeenCalled();
    const body = (await res.json()) as {
      error: string;
      details?: { fieldErrors?: Record<string, string[]> };
    };
    expect(body.error).toBe('Validation failed');
    expect(body.details?.fieldErrors?.client_request_id).toBeDefined();
  });
});
