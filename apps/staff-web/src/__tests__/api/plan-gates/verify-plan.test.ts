import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/lib/api/verify-admin', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

const verifyStaffMock = vi.fn();
vi.mock('@/lib/api/verify-staff', () => ({
  verifyStaff: (req: NextRequest) => verifyStaffMock(req),
}));

const { verifyPlan } = await import('@/lib/api/verify-plan');

function fakeRequest(): NextRequest {
  return { headers: { get: () => null } } as unknown as NextRequest;
}

function staff(tenantId: string, id = 'staff-1', role = 'admin') {
  return { id, role, tenant_id: tenantId };
}

describe('verifyPlan', () => {
  beforeEach(() => {
    mockSingle.mockReset();
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockEq.mockClear();
    verifyStaffMock.mockReset();
  });

  it('returns the plan + staff context when the tenant is on an allowed plan', async () => {
    verifyStaffMock.mockResolvedValueOnce(staff('tenant-pro'));
    mockSingle.mockResolvedValueOnce({ data: { plan: 'pro' }, error: null });

    const result = await verifyPlan(fakeRequest(), ['pro', 'business']);

    expect(result).not.toBeInstanceOf(Response);
    if (result instanceof Response) throw new Error('unreachable');
    expect(result.plan).toBe('pro');
    expect(result.staff.tenant_id).toBe('tenant-pro');
  });

  it('rejects with 403 plan_required when tenant is on a denied plan', async () => {
    verifyStaffMock.mockResolvedValueOnce(staff('tenant-free'));
    mockSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null });

    const result = await verifyPlan(fakeRequest(), ['pro', 'business']);

    expect(result).toBeInstanceOf(Response);
    if (!(result instanceof Response)) throw new Error('unreachable');
    expect(result.status).toBe(403);
    const body = await result.json();
    expect(body).toEqual({ error: 'plan_required' });
  });

  it('forwards the verifyStaff response when auth fails', async () => {
    const unauthorized = new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
    verifyStaffMock.mockResolvedValueOnce(unauthorized);

    const result = await verifyPlan(fakeRequest(), ['pro']);

    expect(result).toBe(unauthorized);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('reads tenants.plan fresh on every call — no in-process cache', async () => {
    // Caching introduced per-instance drift (different serverless processes
    // serving contradictory plan answers within the same 30s window) and a
    // 30s downgrade-still-allowed window. The call rate doesn't justify
    // either bug; fetch fresh every time.
    verifyStaffMock.mockResolvedValue(staff('tenant-fresh'));
    mockSingle.mockResolvedValue({ data: { plan: 'pro' }, error: null });

    await verifyPlan(fakeRequest(), ['pro']);
    await verifyPlan(fakeRequest(), ['pro']);
    await verifyPlan(fakeRequest(), ['pro']);

    expect(mockSingle).toHaveBeenCalledTimes(3);
  });

  it('fails closed when the tenant lookup errors (treats plan as free)', async () => {
    verifyStaffMock.mockResolvedValueOnce(staff('tenant-x'));
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const result = await verifyPlan(fakeRequest(), ['pro', 'business']);

    expect(result).toBeInstanceOf(Response);
    if (!(result instanceof Response)) throw new Error('unreachable');
    expect(result.status).toBe(403);
  });

  it('ignores any plan field in the request body — the JWT is the only source of truth', async () => {
    // The route hands `verifyPlan` the request; plan is resolved from
    // the JWT-derived tenant_id, never parsed from the body. We assert
    // the contract by confirming the body is not consumed (`req.json`
    // is not called) and the resolved plan comes from the DB lookup.
    const reqWithBody = {
      headers: { get: () => null },
      json: vi.fn(),
    } as unknown as NextRequest;
    verifyStaffMock.mockResolvedValueOnce(staff('tenant-free'));
    mockSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null });

    const result = await verifyPlan(reqWithBody, ['pro']);
    expect(
      (reqWithBody as unknown as { json: ReturnType<typeof vi.fn> }).json,
    ).not.toHaveBeenCalled();
    expect(result).toBeInstanceOf(Response);
    if (!(result instanceof Response)) throw new Error('unreachable');
    expect(result.status).toBe(403);
  });
});
