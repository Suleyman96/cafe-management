/**
 * Route-level test for `/api/v1/orders/[id]/discount` (Agent 2 — authz tightening).
 *
 * Pre-fix the route used `verifyStaff` and capped values by role server-side.
 * That left the door open: a waiter calling the endpoint directly (e.g. via
 * DevTools) could apply a small discount because the cap quietly succeeded —
 * while the UI hid the button entirely. We close the gap by gating the
 * endpoint on `verifyAdmin`, mirroring how the UI already treats discounts
 * as admin-only. The tests pin the contract: only admin/owner may invoke
 * this route at all.
 */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyAdminMock = vi.fn();
const supabaseAdminStub = {} as Record<string, unknown>;

vi.mock('@/lib/api/verify-admin', () => ({
  verifyAdmin: (...args: unknown[]) => verifyAdminMock(...args),
  getSupabaseAdmin: () => supabaseAdminStub,
}));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 999, resetAt: 0 }),
  getRateLimitIdentifier: () => '127.0.0.1',
}));

const applyDiscountMock = vi.fn();
vi.mock('@/lib/services/discount-service', () => ({
  applyDiscount: (...args: unknown[]) => applyDiscountMock(...args),
}));

const { NextResponse } = await import('next/server');
const { POST } = await import('@/app/api/v1/orders/[id]/discount/route');

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const CRID = '44444444-4444-4444-8444-444444444444';

function buildRequest(body: Record<string, unknown>): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as unknown as NextRequest;
}

const params = Promise.resolve({ id: ORDER_ID });

beforeEach(() => {
  verifyAdminMock.mockReset();
  applyDiscountMock.mockReset();
  applyDiscountMock.mockResolvedValue({
    order: {
      id: ORDER_ID,
      subtotal: 100,
      tax: 18,
      total: 88,
      discount_type: 'percentage',
      discount_value: 10,
      discount_amount: 10,
    },
    deduped: false,
  });
});

describe('POST /api/v1/orders/[id]/discount — admin-only authz', () => {
  it('returns 403 when verifyAdmin rejects a waiter caller', async () => {
    verifyAdminMock.mockResolvedValueOnce(
      NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 }),
    );

    const res = await POST(
      buildRequest({
        discount_type: 'percentage',
        discount_value: 10,
        discount_applied_by: STAFF_ID,
      }),
      { params },
    );

    expect(res.status).toBe(403);
    expect(applyDiscountMock).not.toHaveBeenCalled();
  });

  it('returns 403 when verifyAdmin rejects a kitchen caller', async () => {
    verifyAdminMock.mockResolvedValueOnce(
      NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 }),
    );

    const res = await POST(
      buildRequest({
        discount_type: 'fixed',
        discount_value: 5,
        discount_applied_by: STAFF_ID,
      }),
      { params },
    );

    expect(res.status).toBe(403);
    expect(applyDiscountMock).not.toHaveBeenCalled();
  });

  it('forwards an admin-applied discount to the service and returns 200', async () => {
    verifyAdminMock.mockResolvedValueOnce({ id: STAFF_ID, role: 'admin', tenant_id: TENANT });

    const res = await POST(
      buildRequest({
        discount_type: 'percentage',
        discount_value: 10,
        discount_reason: 'birthday',
        discount_applied_by: STAFF_ID,
        client_request_id: CRID,
      }),
      { params },
    );

    expect(res.status).toBe(200);
    expect(applyDiscountMock).toHaveBeenCalledTimes(1);
    const call = applyDiscountMock.mock.calls[0]![1] as Record<string, unknown>;
    expect(call.tenantId).toBe(TENANT);
    expect(call.discountType).toBe('percentage');
    expect(call.discountValue).toBe(10);
    expect(call.clientRequestId).toBe(CRID);
    // The service no longer accepts callerRole — the route must not forward it.
    expect(call).not.toHaveProperty('callerRole');
  });

  it('returns 400 when an admin posts a percentage discount above the sanity cap (>100)', async () => {
    const { ValidationError } = await import('@gustri/core');
    verifyAdminMock.mockResolvedValueOnce({ id: STAFF_ID, role: 'admin', tenant_id: TENANT });
    applyDiscountMock.mockRejectedValueOnce(
      new ValidationError('discount_value_out_of_range', {
        fieldErrors: { discount_value: 'Percentage discount must be between 0 and 100' },
      }),
    );

    const res = await POST(
      buildRequest({
        discount_type: 'percentage',
        discount_value: 150,
        discount_reason: 'over the top',
        discount_applied_by: STAFF_ID,
        client_request_id: CRID,
      }),
      { params },
    );

    expect(res.status).toBe(400);
  });
});
