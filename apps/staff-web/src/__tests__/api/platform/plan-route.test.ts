/**
 * Route test for POST /api/v1/platform/tenants/[id]/plan — the manual-billing
 * plan + cadence action. Covers the platform gate, id validation, the
 * free-clears-billing path, and the paid + cycle → computed current_period_end
 * path (monthly = +1 month, yearly = +12 months).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  withScope: (fn: (s: { setTag: () => void }) => void) => fn({ setTag: () => {} }),
}));

const verifyPlatformAdminMock = vi.fn();
vi.mock('@/lib/api/verify-platform-admin', () => ({
  verifyPlatformAdmin: (...a: unknown[]) => verifyPlatformAdminMock(...a),
}));

const supabaseMock = { value: null as unknown };
vi.mock('@/lib/api/verify-admin', () => ({ getSupabaseAdmin: () => supabaseMock.value }));

const { POST } = await import('@/app/api/v1/platform/tenants/[id]/plan/route');

const TENANT_ID = '22222222-2222-4222-8222-222222222222';

function req(body: Record<string, unknown>): NextRequest {
  return {
    headers: { get: () => null },
    url: `http://x/api/v1/platform/tenants/${TENANT_ID}/plan`,
    json: async () => body,
  } as unknown as NextRequest;
}

function params(id = TENANT_ID) {
  return { params: Promise.resolve({ id }) };
}

/** Captures the single `.update(patch)` call on tenants and echoes a row back. */
function makeSupabase() {
  const calls = { update: [] as Record<string, unknown>[] };
  const client = {
    calls,
    from() {
      return {
        update: (vals: Record<string, unknown>) => {
          calls.update.push(vals);
          return {
            eq: () => ({
              select: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { id: TENANT_ID, name: 'Cafe', plan: vals.plan, ...vals },
                    error: null,
                  }),
              }),
            }),
          };
        },
      };
    },
  };
  return client;
}

beforeEach(() => {
  verifyPlatformAdminMock.mockReset();
  verifyPlatformAdminMock.mockResolvedValue({ id: 'admin-1', email: 'boss@gustri.com' });
  supabaseMock.value = makeSupabase();
});

describe('POST /api/v1/platform/tenants/[id]/plan', () => {
  it('403 for non-platform-admins', async () => {
    verifyPlatformAdminMock.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    );
    expect((await POST(req({ plan: 'pro' }), params())).status).toBe(403);
  });

  it('400 for a non-UUID id', async () => {
    expect((await POST(req({ plan: 'pro' }), params('not-a-uuid'))).status).toBe(400);
  });

  it('400 on invalid body (bad plan / bad cycle)', async () => {
    expect((await POST(req({ plan: 'enterprise' }), params())).status).toBe(400);
    expect((await POST(req({ plan: 'pro', billing_cycle: 'weekly' }), params())).status).toBe(400);
  });

  it('free clears billing_cycle and current_period_end', async () => {
    const res = await POST(req({ plan: 'free' }), params());
    expect(res.status).toBe(200);
    const client = supabaseMock.value as ReturnType<typeof makeSupabase>;
    expect(client.calls.update).toEqual([
      { plan: 'free', billing_cycle: null, current_period_end: null },
    ]);
  });

  it('paid + monthly computes current_period_end ~1 month out', async () => {
    const before = Date.now();
    const res = await POST(req({ plan: 'pro', billing_cycle: 'monthly' }), params());
    expect(res.status).toBe(200);
    const patch = (supabaseMock.value as ReturnType<typeof makeSupabase>).calls.update[0]!;
    expect(patch.plan).toBe('pro');
    expect(patch.billing_cycle).toBe('monthly');
    const end = new Date(patch.current_period_end as string).getTime();
    // Between ~28 and ~31 days from now.
    const days = (end - before) / 86_400_000;
    expect(days).toBeGreaterThan(27);
    expect(days).toBeLessThan(32);
  });

  it('paid + yearly computes current_period_end ~12 months out', async () => {
    const before = Date.now();
    const res = await POST(req({ plan: 'business', billing_cycle: 'yearly' }), params());
    expect(res.status).toBe(200);
    const patch = (supabaseMock.value as ReturnType<typeof makeSupabase>).calls.update[0]!;
    expect(patch.billing_cycle).toBe('yearly');
    const days = (new Date(patch.current_period_end as string).getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(360);
    expect(days).toBeLessThan(370);
  });

  it('an explicit current_period_end overrides the computed date', async () => {
    const explicit = '2027-01-01T00:00:00.000Z';
    await POST(
      req({ plan: 'pro', billing_cycle: 'yearly', current_period_end: explicit }),
      params(),
    );
    const patch = (supabaseMock.value as ReturnType<typeof makeSupabase>).calls.update[0]!;
    expect(patch.current_period_end).toBe(explicit);
  });

  it('paid with NO cycle leaves cadence/date untouched (pure tier change)', async () => {
    await POST(req({ plan: 'standard' }), params());
    const patch = (supabaseMock.value as ReturnType<typeof makeSupabase>).calls.update[0]!;
    expect(patch).toEqual({ plan: 'standard' });
  });
});
