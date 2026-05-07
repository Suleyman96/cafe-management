/**
 * Route-level test for `POST /api/v1/customer/orders/[id]/cancel` (M6).
 *
 * Verifies:
 *   1. Schema gate (table_id required, reason length cap).
 *   2. Rate limiter wired through 'order-cancel' category.
 *   3. Service called with the right shape — tenant_id NOT in body.
 */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/verify-admin', () => ({
  getSupabaseAdmin: () => ({}),
}));

const rateLimitMock = vi.fn().mockResolvedValue({ success: true, remaining: 999, resetAt: 0 });
vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  getRateLimitIdentifier: () => '127.0.0.1',
}));

const cancelMock = vi.fn();
vi.mock('@/lib/services/customer-order-service', () => ({
  cancelCustomerOrder: (...args: unknown[]) => cancelMock(...args),
  // Other exports must still resolve so the route module can import the
  // service without errors.
  createCustomerOrder: vi.fn(),
  addCustomerOrderItems: vi.fn(),
}));

const { POST } = await import('@/app/api/v1/customer/orders/[id]/cancel/route');

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const TABLE_ID = '22222222-2222-4222-8222-222222222222';

function buildRequest(body: Record<string, unknown>): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as unknown as NextRequest;
}

const params = Promise.resolve({ id: ORDER_ID });

beforeEach(() => {
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ success: true, remaining: 999, resetAt: 0 });
  cancelMock.mockReset();
});

describe('POST /api/v1/customer/orders/[id]/cancel — schema gate', () => {
  it('rejects payload missing table_id', async () => {
    const res = await POST(buildRequest({ reason: 'changed mind' }), { params });

    expect(res.status).toBe(400);
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('rejects table_id that is not a UUID', async () => {
    const res = await POST(buildRequest({ table_id: 'not-a-uuid' }), { params });

    expect(res.status).toBe(400);
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('rejects reason exceeding 500 chars (matches DB CHECK)', async () => {
    const res = await POST(buildRequest({ table_id: TABLE_ID, reason: 'x'.repeat(501) }), {
      params,
    });

    expect(res.status).toBe(400);
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('forwards a valid payload to the service WITHOUT tenant_id', async () => {
    cancelMock.mockResolvedValue({ id: ORDER_ID, status: 'cancelled' });

    const res = await POST(
      buildRequest({
        table_id: TABLE_ID,
        reason: 'changed mind',
        // Attacker tries to inject tenant_id; route schema strips it.
        tenant_id: '99999999-9999-4999-8999-999999999999',
      }),
      { params },
    );

    expect(res.status).toBe(200);
    expect(cancelMock).toHaveBeenCalledTimes(1);
    const call = cancelMock.mock.calls[0][1] as Record<string, unknown>;
    expect(call).not.toHaveProperty('tenant_id');
    expect(call.orderId).toBe(ORDER_ID);
    expect(call.tableId).toBe(TABLE_ID);
    expect(call.reason).toBe('changed mind');
  });

  it('accepts a valid payload with no reason (server defaults)', async () => {
    cancelMock.mockResolvedValue({ id: ORDER_ID, status: 'cancelled' });

    const res = await POST(buildRequest({ table_id: TABLE_ID }), { params });

    expect(res.status).toBe(200);
    expect(cancelMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: ORDER_ID, tableId: TABLE_ID, reason: null }),
    );
  });
});

describe('POST /api/v1/customer/orders/[id]/cancel — rate limiter', () => {
  it('returns 429 when Upstash reports the limit is exceeded', async () => {
    rateLimitMock.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const res = await POST(buildRequest({ table_id: TABLE_ID }), { params });

    expect(res.status).toBe(429);
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('routes through the "order-cancel" rate-limit category', async () => {
    cancelMock.mockResolvedValue({ id: ORDER_ID, status: 'cancelled' });

    await POST(buildRequest({ table_id: TABLE_ID }), { params });

    expect(rateLimitMock).toHaveBeenCalledWith('order-cancel', '127.0.0.1');
  });
});
