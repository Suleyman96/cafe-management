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

const adjustStockMock = vi.fn();
vi.mock('@/lib/services/stock-service', () => ({
  adjustStock: (...args: unknown[]) => adjustStockMock(...args),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 999, resetAt: 0 }),
  getRateLimitIdentifier: () => '127.0.0.1',
}));

const { POST } = await import('@/app/api/v1/stock/[id]/adjust/route');

function buildRequest(body: Record<string, unknown>): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as unknown as NextRequest;
}

const VALID_BODY = {
  movement_type: 'in',
  quantity_change: 5,
  reason: 'restock',
  client_request_id: '11111111-1111-4111-8111-111111111111',
};

describe('POST /api/v1/stock/[id]/adjust — plan gate', () => {
  beforeEach(() => {
    mockSingle.mockReset();
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockEq.mockClear();
    verifyStaffMock.mockReset();
    adjustStockMock.mockReset();
  });

  it('rejects free-tier callers with 403 plan_required', async () => {
    verifyStaffMock.mockResolvedValueOnce({
      id: 'staff-free',
      role: 'admin',
      tenant_id: 'tenant-free',
    });
    mockSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null });

    const res = await POST(buildRequest(VALID_BODY), { params: Promise.resolve({ id: 'item-1' }) });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: 'plan_required' });
    expect(adjustStockMock).not.toHaveBeenCalled();
  });

  it('lets pro-tier callers through to the stock service', async () => {
    verifyStaffMock.mockResolvedValueOnce({
      id: 'staff-pro',
      role: 'admin',
      tenant_id: 'tenant-pro',
    });
    mockSingle.mockResolvedValueOnce({ data: { plan: 'pro' }, error: null });
    adjustStockMock.mockResolvedValueOnce({
      stockItem: { id: 'item-1', quantity: 15 },
      deduped: false,
    });

    const res = await POST(buildRequest(VALID_BODY), { params: Promise.resolve({ id: 'item-1' }) });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.stockItem).toEqual({ id: 'item-1', quantity: 15 });
    expect(adjustStockMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        stockItemId: 'item-1',
        tenantId: 'tenant-pro',
        data: expect.objectContaining({ movement_type: 'in', quantity_change: 5 }),
      }),
    );
  });

  it('ignores a body-supplied tenantPlan field — JWT-derived plan is authoritative', async () => {
    verifyStaffMock.mockResolvedValueOnce({
      id: 'staff-free',
      role: 'admin',
      tenant_id: 'tenant-free',
    });
    mockSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null });

    const res = await POST(buildRequest({ ...VALID_BODY, tenantPlan: 'pro', plan: 'business' }), {
      params: Promise.resolve({ id: 'item-1' }),
    });

    expect(res.status).toBe(403);
    expect(adjustStockMock).not.toHaveBeenCalled();
  });
});
