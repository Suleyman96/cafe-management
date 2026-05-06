/**
 * Route-level test for `/api/v1/customer/waiter-calls` (H1 / PR3).
 *
 * Asserts the schema gate and the rate-limiter wiring. The service layer
 * is mocked — its tenant-resolution behavior is covered separately.
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

const createWaiterCallMock = vi.fn();
vi.mock('@/lib/services/customer-engagement-service', () => ({
  createCustomerWaiterCall: (...args: unknown[]) => createWaiterCallMock(...args),
  // The other export must still be present for module resolution even if
  // this test doesn't exercise it.
  createCustomerFeedback: vi.fn(),
}));

const { POST } = await import('@/app/api/v1/customer/waiter-calls/route');

const TABLE_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_REQ_ID = '55555555-5555-4555-8555-555555555555';

function buildRequest(body: Record<string, unknown>): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as unknown as NextRequest;
}

beforeEach(() => {
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ success: true, remaining: 999, resetAt: 0 });
  createWaiterCallMock.mockReset();
});

describe('POST /api/v1/customer/waiter-calls — schema gate', () => {
  it('rejects payload missing table_id', async () => {
    const res = await POST(
      buildRequest({
        call_type: 'assistance',
        priority: 'normal',
        client_request_id: CLIENT_REQ_ID,
      }),
    );

    expect(res.status).toBe(400);
    expect(createWaiterCallMock).not.toHaveBeenCalled();
  });

  it('rejects payload missing client_request_id', async () => {
    const res = await POST(
      buildRequest({
        table_id: TABLE_ID,
        call_type: 'assistance',
        priority: 'normal',
      }),
    );

    expect(res.status).toBe(400);
    expect(createWaiterCallMock).not.toHaveBeenCalled();
  });

  it('rejects unknown call_type', async () => {
    const res = await POST(
      buildRequest({
        table_id: TABLE_ID,
        call_type: 'shouting',
        priority: 'normal',
        client_request_id: CLIENT_REQ_ID,
      }),
    );

    expect(res.status).toBe(400);
    expect(createWaiterCallMock).not.toHaveBeenCalled();
  });

  it('rejects notes exceeding 500 chars', async () => {
    const res = await POST(
      buildRequest({
        table_id: TABLE_ID,
        call_type: 'assistance',
        priority: 'normal',
        notes: 'x'.repeat(501),
        client_request_id: CLIENT_REQ_ID,
      }),
    );

    expect(res.status).toBe(400);
    expect(createWaiterCallMock).not.toHaveBeenCalled();
  });

  it('forwards a valid payload to the service WITHOUT tenant_id', async () => {
    createWaiterCallMock.mockResolvedValue({ row: { id: 'c1' }, deduped: false });

    const res = await POST(
      buildRequest({
        table_id: TABLE_ID,
        call_type: 'assistance',
        priority: 'normal',
        // Attacker tries to inject a tenant_id; route schema strips it.
        tenant_id: '99999999-9999-4999-8999-999999999999',
        client_request_id: CLIENT_REQ_ID,
      }),
    );

    expect(res.status).toBe(201);
    expect(createWaiterCallMock).toHaveBeenCalledTimes(1);
    const call = createWaiterCallMock.mock.calls[0][1] as Record<string, unknown>;
    expect(call).not.toHaveProperty('tenant_id');
    expect(call.table_id).toBe(TABLE_ID);
    expect(call.client_request_id).toBe(CLIENT_REQ_ID);
  });

  it('returns 200 (not 201) when the service reports a deduped replay', async () => {
    createWaiterCallMock.mockResolvedValue({ row: { id: 'c1' }, deduped: true });

    const res = await POST(
      buildRequest({
        table_id: TABLE_ID,
        call_type: 'assistance',
        priority: 'normal',
        client_request_id: CLIENT_REQ_ID,
      }),
    );

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/customer/waiter-calls — rate limiter', () => {
  it('returns 429 when Upstash reports the limit is exceeded', async () => {
    rateLimitMock.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const res = await POST(
      buildRequest({
        table_id: TABLE_ID,
        call_type: 'assistance',
        priority: 'normal',
        client_request_id: CLIENT_REQ_ID,
      }),
    );

    expect(res.status).toBe(429);
    expect(createWaiterCallMock).not.toHaveBeenCalled();
  });

  it('routes the request through the "waiter-call" rate-limit category', async () => {
    createWaiterCallMock.mockResolvedValue({ row: { id: 'c1' }, deduped: false });

    await POST(
      buildRequest({
        table_id: TABLE_ID,
        call_type: 'assistance',
        priority: 'normal',
        client_request_id: CLIENT_REQ_ID,
      }),
    );

    expect(rateLimitMock).toHaveBeenCalledWith('waiter-call', '127.0.0.1');
  });
});
