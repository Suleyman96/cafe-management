/**
 * Route-level test for `/api/v1/orders/[id]/assign` (Agent 2 — authz tightening).
 *
 * Pre-fix `db.orders.assignWaiter` was a direct wrapper UPDATE; RLS lets
 * any active staff write `assigned_waiter_id`, so a waiter could pull
 * another waiter's open order off them mid-shift. The wrapper method is
 * gone and the new route gates on `verifyAdmin` + service-role write.
 * These tests pin the contract: only admin/owner can reassign, and the
 * payload shape is enforced.
 */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyAdminMock = vi.fn();

const updateChainSingle = vi.fn();
const supabaseAdminStub = {
  from: vi.fn(() => ({
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: updateChainSingle,
          })),
        })),
      })),
    })),
  })),
};

vi.mock('@/lib/api/verify-admin', () => ({
  verifyAdmin: (...args: unknown[]) => verifyAdminMock(...args),
  getSupabaseAdmin: () => supabaseAdminStub,
}));

const { NextResponse } = await import('next/server');
const { POST } = await import('@/app/api/v1/orders/[id]/assign/route');

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const WAITER_ID = '33333333-3333-4333-8333-333333333333';
const ADMIN_ID = '44444444-4444-4444-8444-444444444444';

function buildRequest(body: unknown): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as unknown as NextRequest;
}

const params = Promise.resolve({ id: ORDER_ID });

beforeEach(() => {
  verifyAdminMock.mockReset();
  updateChainSingle.mockReset();
  updateChainSingle.mockResolvedValue({
    data: { id: ORDER_ID, assigned_waiter_id: WAITER_ID, tenant_id: TENANT },
    error: null,
  });
});

describe('POST /api/v1/orders/[id]/assign — admin-only authz', () => {
  it('returns 403 when verifyAdmin rejects a waiter caller', async () => {
    verifyAdminMock.mockResolvedValueOnce(
      NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 }),
    );

    const res = await POST(buildRequest({ waiter_id: WAITER_ID }), { params });

    expect(res.status).toBe(403);
    expect(updateChainSingle).not.toHaveBeenCalled();
  });

  it('returns 200 and forwards the assignment when the caller is admin', async () => {
    verifyAdminMock.mockResolvedValueOnce({ id: ADMIN_ID, role: 'admin', tenant_id: TENANT });

    const res = await POST(buildRequest({ waiter_id: WAITER_ID }), { params });

    expect(res.status).toBe(200);
    expect(updateChainSingle).toHaveBeenCalledTimes(1);
  });

  it('accepts waiter_id=null (unassign)', async () => {
    verifyAdminMock.mockResolvedValueOnce({ id: ADMIN_ID, role: 'owner', tenant_id: TENANT });
    updateChainSingle.mockResolvedValueOnce({
      data: { id: ORDER_ID, assigned_waiter_id: null, tenant_id: TENANT },
      error: null,
    });

    const res = await POST(buildRequest({ waiter_id: null }), { params });

    expect(res.status).toBe(200);
  });

  it('returns 400 when waiter_id is missing from the body', async () => {
    verifyAdminMock.mockResolvedValueOnce({ id: ADMIN_ID, role: 'admin', tenant_id: TENANT });

    const res = await POST(buildRequest({}), { params });

    expect(res.status).toBe(400);
    expect(updateChainSingle).not.toHaveBeenCalled();
  });

  it('returns 400 when waiter_id is not a UUID', async () => {
    verifyAdminMock.mockResolvedValueOnce({ id: ADMIN_ID, role: 'admin', tenant_id: TENANT });

    const res = await POST(buildRequest({ waiter_id: 'not-a-uuid' }), { params });

    expect(res.status).toBe(400);
    expect(updateChainSingle).not.toHaveBeenCalled();
  });
});
