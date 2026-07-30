/**
 * Route-level test for `POST /api/v1/admin/tenant/deactivate` (tenant soft-close).
 *
 * Verifies:
 *   1. Rate-limit gate runs first.
 *   2. verifyAdmin gate, then owner-only narrowing (admins are rejected).
 *   3. The confirmation phrase is required (bad/missing → 400).
 *   4. Happy path flips is_active=false with audit metadata, scoped to the
 *      caller's own tenant_id (never a body-supplied id).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  withScope: (fn: (scope: { setTag: () => void }) => void) => fn({ setTag: () => {} }),
}));

const verifyAdminMock = vi.fn();
const supabaseMock = { value: null as unknown };
vi.mock('@/lib/api/verify-admin', () => ({
  getSupabaseAdmin: () => supabaseMock.value,
  verifyAdmin: (...args: unknown[]) => verifyAdminMock(...args),
}));

const rateLimitMock = vi.fn();
vi.mock('@/lib/api/rate-limit', () => ({
  getRateLimitIdentifier: () => '1.2.3.4',
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
}));

const { POST } = await import('@/app/api/v1/admin/tenant/deactivate/route');

const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const OWNER_ID = '33333333-3333-4333-8333-333333333333';

function buildRequest(body: Record<string, unknown>): NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://localhost/api/v1/admin/tenant/deactivate',
    json: async () => body,
  } as unknown as NextRequest;
}

function makeSupabase(opts: { updateError?: boolean } = {}) {
  const calls: { update: Record<string, unknown>; eqCol: string; eqVal: unknown }[] = [];
  const client = {
    calls,
    from(_table: string) {
      return {
        update(vals: Record<string, unknown>) {
          return {
            eq(eqCol: string, eqVal: unknown) {
              calls.push({ update: vals, eqCol, eqVal });
              return Promise.resolve({ error: opts.updateError ? { message: 'boom' } : null });
            },
          };
        },
      };
    },
  };
  return client;
}

beforeEach(() => {
  verifyAdminMock.mockReset();
  rateLimitMock.mockReset();
  rateLimitMock.mockResolvedValue({ success: true, remaining: 2, resetAt: 0 });
  verifyAdminMock.mockResolvedValue({ id: OWNER_ID, role: 'owner', tenant_id: TENANT_ID });
  supabaseMock.value = makeSupabase();
});

describe('POST /api/v1/admin/tenant/deactivate — gates', () => {
  it('429s when rate limited, before auth', async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, resetAt: Date.now() + 1000 });
    const res = await POST(buildRequest({ confirmation: 'CLOSE' }));
    expect(res.status).toBe(429);
    expect(verifyAdminMock).not.toHaveBeenCalled();
  });

  it('returns the verifyAdmin error for unauthenticated callers', async () => {
    verifyAdminMock.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );
    const res = await POST(buildRequest({ confirmation: 'CLOSE' }));
    expect(res.status).toBe(401);
  });

  it('rejects a non-owner admin with 403', async () => {
    verifyAdminMock.mockResolvedValue({ id: OWNER_ID, role: 'admin', tenant_id: TENANT_ID });
    const res = await POST(buildRequest({ confirmation: 'CLOSE' }));
    expect(res.status).toBe(403);
    const client = supabaseMock.value as ReturnType<typeof makeSupabase>;
    expect(client.calls).toHaveLength(0);
  });

  it('requires the exact CLOSE confirmation phrase', async () => {
    const res = await POST(buildRequest({ confirmation: 'close' }));
    expect(res.status).toBe(400);
    const missing = await POST(buildRequest({}));
    expect(missing.status).toBe(400);
  });
});

describe('POST /api/v1/admin/tenant/deactivate — effect', () => {
  it('flips is_active=false with audit metadata on the caller tenant', async () => {
    const res = await POST(buildRequest({ confirmation: 'CLOSE', reason: 'closing shop' }));
    expect(res.status).toBe(200);

    const client = supabaseMock.value as ReturnType<typeof makeSupabase>;
    expect(client.calls).toHaveLength(1);
    const call = client.calls[0]!;
    expect(call.eqCol).toBe('id');
    expect(call.eqVal).toBe(TENANT_ID);
    expect(call.update.is_active).toBe(false);
    expect(call.update.deactivated_by).toBe(OWNER_ID);
    expect(call.update.deactivation_reason).toBe('closing shop');
    expect(typeof call.update.deactivated_at).toBe('string');
  });

  it('ignores a body-supplied tenant id (scopes to verified claim)', async () => {
    await POST(buildRequest({ confirmation: 'CLOSE', tenant_id: 'attacker-tenant' }));
    const client = supabaseMock.value as ReturnType<typeof makeSupabase>;
    expect(client.calls[0]!.eqVal).toBe(TENANT_ID);
  });

  it('500s when the update fails', async () => {
    supabaseMock.value = makeSupabase({ updateError: true });
    const res = await POST(buildRequest({ confirmation: 'CLOSE' }));
    expect(res.status).toBe(500);
  });
});
