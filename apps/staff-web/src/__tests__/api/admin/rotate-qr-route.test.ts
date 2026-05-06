/**
 * Route-level test for `POST /api/v1/admin/tables/[id]/rotate-qr` (H2 / PR4).
 *
 * Verifies:
 *   1. Admin auth gate (verifyAdmin) runs before the body is touched.
 *   2. The service receives `tenantId` from the verified admin's claims,
 *      NOT from the URL or body — the C1 / cross-tenant pattern.
 *   3. Optional `expires_at` is forwarded as a Date or null per spec.
 *   4. Schema rejects garbage `expires_at` values.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyAdminMock = vi.fn();
vi.mock('@/lib/api/verify-admin', () => ({
  getSupabaseAdmin: () => ({}),
  verifyAdmin: (...args: unknown[]) => verifyAdminMock(...args),
}));

const rotateMock = vi.fn();
vi.mock('@/lib/services/table-qr-service', () => ({
  rotateTableQrCode: (...args: unknown[]) => rotateMock(...args),
}));

const { POST } = await import('@/app/api/v1/admin/tables/[id]/rotate-qr/route');

const TABLE_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';

function buildRequest(body?: Record<string, unknown>): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => body ?? {},
  } as unknown as NextRequest;
}

const params = Promise.resolve({ id: TABLE_ID });

beforeEach(() => {
  verifyAdminMock.mockReset();
  rotateMock.mockReset();
});

describe('POST /api/v1/admin/tables/[id]/rotate-qr — auth', () => {
  it('returns the verifyAdmin error response when the caller is not admin', async () => {
    verifyAdminMock.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );

    const res = await POST(buildRequest(), { params });

    expect(res.status).toBe(401);
    expect(rotateMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/admin/tables/[id]/rotate-qr — schema', () => {
  beforeEach(() => {
    verifyAdminMock.mockResolvedValue({
      id: ADMIN_ID,
      role: 'admin',
      tenant_id: TENANT_ID,
    });
  });

  it('rejects a non-ISO expires_at', async () => {
    const res = await POST(buildRequest({ expires_at: 'tomorrow' }), { params });

    expect(res.status).toBe(400);
    expect(rotateMock).not.toHaveBeenCalled();
  });

  it('accepts an empty body and uses the service default', async () => {
    rotateMock.mockResolvedValue({ id: TABLE_ID, qr_code: 'new-uuid' });

    const res = await POST(buildRequest(), { params });

    expect(res.status).toBe(200);
    expect(rotateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tableId: TABLE_ID,
        tenantId: TENANT_ID,
        expiresAt: undefined,
      }),
    );
  });

  it('forwards expires_at: null for "no expiry"', async () => {
    rotateMock.mockResolvedValue({ id: TABLE_ID, qr_code: 'new-uuid' });

    await POST(buildRequest({ expires_at: null }), { params });

    expect(rotateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ expiresAt: null }),
    );
  });

  it('forwards expires_at as a Date when ISO string given', async () => {
    rotateMock.mockResolvedValue({ id: TABLE_ID, qr_code: 'new-uuid' });
    const iso = '2027-01-01T00:00:00.000Z';

    await POST(buildRequest({ expires_at: iso }), { params });

    const call = rotateMock.mock.calls[0][1];
    expect(call.expiresAt).toBeInstanceOf(Date);
    expect((call.expiresAt as Date).toISOString()).toBe(iso);
  });
});

describe('POST /api/v1/admin/tables/[id]/rotate-qr — cross-tenant', () => {
  it('passes admin tenant_id to the service even if URL is for a foreign table', async () => {
    // The service-side filter on (id, tenant_id) is what actually
    // prevents the cross-tenant rotation; this test just asserts the
    // route is forwarding the verified tenant_id, not anything from
    // the URL or body.
    verifyAdminMock.mockResolvedValue({
      id: ADMIN_ID,
      role: 'admin',
      tenant_id: TENANT_ID,
    });
    rotateMock.mockResolvedValue({ id: TABLE_ID, qr_code: 'new-uuid' });

    await POST(buildRequest({ tenant_id: 'attacker-tenant' }), { params });

    const call = rotateMock.mock.calls[0][1];
    expect(call.tenantId).toBe(TENANT_ID);
    expect(call.tenantId).not.toBe('attacker-tenant');
  });
});
