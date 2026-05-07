/**
 * Route-level test for `/api/v1/customer/qr-tokens/resolve` — the trust
 * boundary that closes the deferred multi-tenant SSR gap (plans/18).
 *
 * Asserts the schema gate + rate-limiter wiring + service hand-off. The
 * service layer is mocked; its token-resolution semantics are covered
 * by `customer-qr-token-service.test.ts`.
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

const resolveMock = vi.fn();
vi.mock('@/lib/services/customer-qr-token-service', () => ({
  resolveCustomerQrToken: (...args: unknown[]) => resolveMock(...args),
}));

const { POST } = await import('@/app/api/v1/customer/qr-tokens/resolve/route');

const TOKEN = 'tkn_legit';

function buildRequest(body: Record<string, unknown>): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as unknown as NextRequest;
}

beforeEach(() => {
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ success: true, remaining: 999, resetAt: 0 });
  resolveMock.mockReset();
});

describe('POST /api/v1/customer/qr-tokens/resolve — schema gate', () => {
  it('rejects payload missing qr_token', async () => {
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(400);
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('rejects qr_token longer than the 128-char cap', async () => {
    const res = await POST(buildRequest({ qr_token: 'x'.repeat(129) }));
    expect(res.status).toBe(400);
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('rejects empty qr_token (min length 1)', async () => {
    const res = await POST(buildRequest({ qr_token: '' }));
    expect(res.status).toBe(400);
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('forwards a valid payload to the service and returns the tenant_id', async () => {
    resolveMock.mockResolvedValue({ tenant_id: 'tenant-1' });

    const res = await POST(buildRequest({ qr_token: TOKEN }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ tenant_id: 'tenant-1' });
    expect(resolveMock).toHaveBeenCalledWith(expect.any(Object), { qr_token: TOKEN });
  });
});

describe('POST /api/v1/customer/qr-tokens/resolve — rate limiter', () => {
  it('returns 429 when Upstash reports the limit is exceeded', async () => {
    rateLimitMock.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const res = await POST(buildRequest({ qr_token: TOKEN }));

    expect(res.status).toBe(429);
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('routes the request through the "customer-qr-token" rate-limit category', async () => {
    resolveMock.mockResolvedValue({ tenant_id: 'tenant-1' });

    await POST(buildRequest({ qr_token: TOKEN }));

    expect(rateLimitMock).toHaveBeenCalledWith('customer-qr-token', '127.0.0.1');
  });
});

describe('POST /api/v1/customer/qr-tokens/resolve — error mapping', () => {
  it('returns 400 invalid_qr_token when the service throws ValidationError', async () => {
    const { ValidationError } = await import('@gustri/core');
    resolveMock.mockRejectedValueOnce(new ValidationError('invalid_qr_token'));

    const res = await POST(buildRequest({ qr_token: TOKEN }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'invalid_qr_token' });
  });

  it('returns 403 plan_required when the service throws the plan sentinel', async () => {
    resolveMock.mockRejectedValueOnce(new Error('plan_required'));

    const res = await POST(buildRequest({ qr_token: TOKEN }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: 'plan_required' });
  });
});
