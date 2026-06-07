/**
 * Route-level test for `/api/v1/customer/feedback` (H1 / PR3).
 *
 * Same shape as the waiter-calls test. S4 — feedback now carries a
 * `client_request_id` so a replay/rage-tap dedupes on the partial
 * unique index in migration 20260517000001. The rate limiter remains
 * the outer spam guard.
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

const createFeedbackMock = vi.fn();
vi.mock('@/lib/services/customer-engagement-service', () => ({
  createCustomerFeedback: (...args: unknown[]) => createFeedbackMock(...args),
  createCustomerWaiterCall: vi.fn(),
}));

const { POST } = await import('@/app/api/v1/customer/feedback/route');

const TABLE_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const CLIENT_REQUEST_ID = '33333333-3333-4333-8333-333333333333';

function buildRequest(body: Record<string, unknown>): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as unknown as NextRequest;
}

beforeEach(() => {
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ success: true, remaining: 999, resetAt: 0 });
  createFeedbackMock.mockReset();
});

describe('POST /api/v1/customer/feedback — schema gate', () => {
  it('rejects payload missing table_id', async () => {
    const res = await POST(
      buildRequest({
        feedback_type: 'praise',
        message: 'Loved it!',
        client_request_id: CLIENT_REQUEST_ID,
      }),
    );

    expect(res.status).toBe(400);
    expect(createFeedbackMock).not.toHaveBeenCalled();
  });

  it('rejects unknown feedback_type', async () => {
    const res = await POST(
      buildRequest({
        table_id: TABLE_ID,
        feedback_type: 'rant',
        message: 'Hello',
        client_request_id: CLIENT_REQUEST_ID,
      }),
    );

    expect(res.status).toBe(400);
    expect(createFeedbackMock).not.toHaveBeenCalled();
  });

  it('rejects empty message', async () => {
    const res = await POST(
      buildRequest({
        table_id: TABLE_ID,
        feedback_type: 'praise',
        message: '',
        client_request_id: CLIENT_REQUEST_ID,
      }),
    );

    expect(res.status).toBe(400);
    expect(createFeedbackMock).not.toHaveBeenCalled();
  });

  it('rejects message exceeding 1000 chars (matches DB CHECK)', async () => {
    const res = await POST(
      buildRequest({
        table_id: TABLE_ID,
        feedback_type: 'complaint',
        message: 'x'.repeat(1001),
        client_request_id: CLIENT_REQUEST_ID,
      }),
    );

    expect(res.status).toBe(400);
    expect(createFeedbackMock).not.toHaveBeenCalled();
  });

  it('rejects payload missing client_request_id (S4)', async () => {
    const res = await POST(
      buildRequest({
        table_id: TABLE_ID,
        feedback_type: 'praise',
        message: 'Nice',
      }),
    );

    expect(res.status).toBe(400);
    expect(createFeedbackMock).not.toHaveBeenCalled();
  });

  it('forwards a valid payload to the service WITHOUT tenant_id and threads client_request_id', async () => {
    createFeedbackMock.mockResolvedValue({ row: { id: 'f1' }, deduped: false });

    const res = await POST(
      buildRequest({
        table_id: TABLE_ID,
        order_id: ORDER_ID,
        feedback_type: 'praise',
        message: 'Great service',
        client_request_id: CLIENT_REQUEST_ID,
        // Attacker tries to inject a tenant_id; route schema strips it.
        tenant_id: '99999999-9999-4999-8999-999999999999',
      }),
    );

    expect(res.status).toBe(201);
    expect(createFeedbackMock).toHaveBeenCalledTimes(1);
    const call = createFeedbackMock.mock.calls[0]![1] as Record<string, unknown>;
    expect(call).not.toHaveProperty('tenant_id');
    expect(call.table_id).toBe(TABLE_ID);
    expect(call.order_id).toBe(ORDER_ID);
    expect(call.client_request_id).toBe(CLIENT_REQUEST_ID);
  });

  it('returns 200 when the service reports a deduped replay (S4)', async () => {
    createFeedbackMock.mockResolvedValue({ row: { id: 'f1' }, deduped: true });

    const res = await POST(
      buildRequest({
        table_id: TABLE_ID,
        feedback_type: 'praise',
        message: 'Great service',
        client_request_id: CLIENT_REQUEST_ID,
      }),
    );

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/customer/feedback — rate limiter', () => {
  it('returns 429 when Upstash reports the limit is exceeded', async () => {
    rateLimitMock.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 300_000,
    });

    const res = await POST(
      buildRequest({
        table_id: TABLE_ID,
        feedback_type: 'praise',
        message: 'Nice',
        client_request_id: CLIENT_REQUEST_ID,
      }),
    );

    expect(res.status).toBe(429);
    expect(createFeedbackMock).not.toHaveBeenCalled();
  });

  it('routes the request through the "feedback" rate-limit category', async () => {
    createFeedbackMock.mockResolvedValue({ row: { id: 'f1' }, deduped: false });

    await POST(
      buildRequest({
        table_id: TABLE_ID,
        feedback_type: 'praise',
        message: 'Nice',
        client_request_id: CLIENT_REQUEST_ID,
      }),
    );

    expect(rateLimitMock).toHaveBeenCalledWith('feedback', '127.0.0.1');
  });
});
