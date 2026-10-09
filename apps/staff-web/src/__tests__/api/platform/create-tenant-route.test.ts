/**
 * Route test for POST /api/v1/platform/tenants (operator-created tenant).
 * Covers the platform gate, validation, duplicate-email 409, the happy path
 * (createUser gets the provisioning metadata + the paid plan is applied), and
 * orphan cleanup when provisioning didn't create a tenant.
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

const rateLimitMock = vi.fn();
vi.mock('@/lib/api/rate-limit', () => ({
  getRateLimitIdentifier: () => '1.2.3.4',
  rateLimit: (...a: unknown[]) => rateLimitMock(...a),
}));

const { POST } = await import('@/app/api/v1/platform/tenants/route');

const TENANT_ID = '22222222-2222-4222-8222-222222222222';

function req(body: Record<string, unknown>): NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://x/api/v1/platform/tenants',
    json: async () => body,
  } as unknown as NextRequest;
}

function makeSupabase(
  opts: { createErr?: string; userId?: string | null; staffTenant?: string | null } = {},
) {
  const calls = {
    createUser: [] as unknown[],
    deleteUser: [] as unknown[],
    planUpdate: [] as Record<string, unknown>[],
    audit: [] as Record<string, unknown>[],
  };
  const client = {
    calls,
    auth: {
      admin: {
        createUser: (o: unknown) => {
          calls.createUser.push(o);
          return Promise.resolve(
            opts.createErr
              ? { data: null, error: { message: opts.createErr } }
              : { data: { user: { id: opts.userId ?? 'auth-1' } }, error: null },
          );
        },
        deleteUser: (id: unknown) => {
          calls.deleteUser.push(id);
          return Promise.resolve({ error: null });
        },
      },
    },
    from(table: string) {
      if (table === 'platform_audit_log') {
        return {
          insert: (row: Record<string, unknown>) => {
            calls.audit.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data:
                  opts.staffTenant === undefined
                    ? { tenant_id: TENANT_ID }
                    : opts.staffTenant
                      ? { tenant_id: opts.staffTenant }
                      : null,
                error: null,
              }),
            single: () =>
              Promise.resolve({
                data: { id: TENANT_ID, name: 'Cafe', plan: 'pro', is_active: true },
                error: null,
              }),
          }),
        }),
        update: (vals: Record<string, unknown>) => {
          if (table === 'tenants') calls.planUpdate.push(vals);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
    },
  };
  return client;
}

beforeEach(() => {
  verifyPlatformAdminMock.mockReset();
  rateLimitMock.mockReset();
  rateLimitMock.mockResolvedValue({ success: true, remaining: 5, resetAt: 0 });
  verifyPlatformAdminMock.mockResolvedValue({ id: 'admin-1', email: 'boss@gustri.com' });
  supabaseMock.value = makeSupabase();
});

const good = {
  cafe_name: 'Blue Bottle',
  owner_email: 'owner@blue.com',
  password: 'hunter2x',
  plan: 'pro',
};

describe('POST /api/v1/platform/tenants', () => {
  it('403 for non-platform-admins', async () => {
    verifyPlatformAdminMock.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    );
    expect((await POST(req(good))).status).toBe(403);
  });

  it('400 on invalid body (short password / bad email)', async () => {
    expect((await POST(req({ ...good, password: 'short' }))).status).toBe(400);
    expect((await POST(req({ ...good, owner_email: 'nope' }))).status).toBe(400);
  });

  it('creates the owner with provisioning metadata and applies the paid plan', async () => {
    const res = await POST(req(good));
    expect(res.status).toBe(201);
    const client = supabaseMock.value as ReturnType<typeof makeSupabase>;
    const createArg = client.calls.createUser[0] as {
      email: string;
      email_confirm: boolean;
      user_metadata: Record<string, string>;
    };
    expect(createArg.email).toBe('owner@blue.com');
    expect(createArg.email_confirm).toBe(true);
    expect(createArg.user_metadata.signup).toBe('platform');
    expect(createArg.user_metadata.restaurant_name).toBe('Blue Bottle');
    // pro (paid) → plan update applied
    expect(client.calls.planUpdate).toEqual([{ plan: 'pro' }]);
    // L12: operator action recorded.
    expect(client.calls.audit).toHaveLength(1);
    expect(client.calls.audit[0]!.action).toBe('tenant_create');
    expect(client.calls.audit[0]!.actor_email).toBe('boss@gustri.com');
    expect(client.calls.audit[0]!.tenant_id).toBe(TENANT_ID);
  });

  it('does NOT set plan for a free tenant (trigger already provisions free)', async () => {
    await POST(req({ ...good, plan: 'free' }));
    expect((supabaseMock.value as ReturnType<typeof makeSupabase>).calls.planUpdate).toEqual([]);
  });

  it('sets billing_cycle + computed current_period_end when a cycle is given', async () => {
    const before = Date.now();
    const res = await POST(req({ ...good, plan: 'pro', billing_cycle: 'yearly' }));
    expect(res.status).toBe(201);
    const patch = (supabaseMock.value as ReturnType<typeof makeSupabase>).calls.planUpdate[0]!;
    expect(patch.plan).toBe('pro');
    expect(patch.billing_cycle).toBe('yearly');
    const days = (new Date(patch.current_period_end as string).getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(360);
    expect(days).toBeLessThan(370);
  });

  it('paid plan with NO cycle sets only the plan (no date)', async () => {
    await POST(req(good)); // good = plan 'pro', no billing_cycle
    expect((supabaseMock.value as ReturnType<typeof makeSupabase>).calls.planUpdate).toEqual([
      { plan: 'pro' },
    ]);
  });

  it('409 when the email already exists', async () => {
    supabaseMock.value = makeSupabase({
      createErr: 'A user with this email address has already been registered',
    });
    const res = await POST(req(good));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('email_in_use');
  });

  it('deletes the orphan user + 500 when provisioning created no tenant', async () => {
    supabaseMock.value = makeSupabase({ staffTenant: null });
    const res = await POST(req(good));
    expect(res.status).toBe(500);
    const client = supabaseMock.value as ReturnType<typeof makeSupabase>;
    expect(client.calls.deleteUser).toEqual(['auth-1']);
  });
});
