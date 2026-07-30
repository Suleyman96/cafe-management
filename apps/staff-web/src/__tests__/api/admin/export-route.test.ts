/**
 * Route-level test for `GET /api/v1/admin/export` (GDPR data portability).
 *
 * Verifies:
 *   1. Rate-limit gate runs before anything else (429 short-circuits).
 *   2. Admin auth gate (verifyAdmin) blocks non-admins.
 *   3. Happy path returns a JSON attachment whose payload is tenant-scoped,
 *      redacts staff pin_hash, and excludes the secret-bearing tables.
 *   4. Every table query filters on the verified admin's tenant_id — the only
 *      thing isolating tenants once the service role bypasses RLS.
 *   5. delivery_customers_decrypted is fetched via a USER-context client (so the
 *      role-gated decrypt actually returns phone numbers).
 *   6. A table read error fails the whole export (no silent partial dump).
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

// The route builds a user-context client (caller's JWT) for the delivery view.
const userClientMock = { value: null as unknown };
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => userClientMock.value,
}));

const { GET } = await import('@/app/api/v1/admin/export/route');

const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';

function buildRequest(): NextRequest {
  return {
    headers: { get: (h: string) => (h === 'Authorization' ? 'Bearer test-token' : null) },
    url: 'http://localhost/api/v1/admin/export',
  } as unknown as NextRequest;
}

/**
 * Service-role Supabase double. Records the column projection per table
 * (`selectCalls`) and every filter (`eqCalls`). `.eq(...)` is awaited directly
 * for list tables and chained into `.single()` for the `tenants` row.
 */
function makeSupabase(opts: { errorTable?: string } = {}) {
  const eqCalls: { table: string; col: string; val: unknown }[] = [];
  const selectCalls: { table: string; cols: string }[] = [];
  const client = {
    eqCalls,
    selectCalls,
    from(table: string) {
      const rows = [{ id: `${table}-row`, tenant_id: TENANT_ID }];
      const result =
        opts.errorTable === table
          ? { data: null, error: { message: 'boom' } }
          : { data: rows, error: null };
      const eq = (col: string, val: unknown) => {
        eqCalls.push({ table, col, val });
        const p = Promise.resolve(result) as Promise<typeof result> & {
          single: () => Promise<{ data: unknown; error: null }>;
        };
        p.single = () => Promise.resolve({ data: { id: TENANT_ID, name: 'Cafe' }, error: null });
        return p;
      };
      return {
        select: (cols: string) => {
          selectCalls.push({ table, cols });
          return { eq };
        },
      };
    },
  };
  return client;
}

/** User-context client double — only serves delivery_customers_decrypted. */
function makeUserClient() {
  const eqCalls: { table: string; col: string; val: unknown }[] = [];
  return {
    eqCalls,
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: unknown) => {
          eqCalls.push({ table, col, val });
          return Promise.resolve({
            data: [{ id: 'dc1', tenant_id: TENANT_ID, decrypted_phone: '+100000000' }],
            error: null,
          });
        },
      }),
    }),
  };
}

beforeEach(() => {
  verifyAdminMock.mockReset();
  rateLimitMock.mockReset();
  rateLimitMock.mockResolvedValue({ success: true, remaining: 2, resetAt: 0 });
  verifyAdminMock.mockResolvedValue({ id: ADMIN_ID, role: 'admin', tenant_id: TENANT_ID });
  supabaseMock.value = makeSupabase();
  userClientMock.value = makeUserClient();
});

describe('GET /api/v1/admin/export — gates', () => {
  it('short-circuits with 429 when rate limited, before auth', async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, resetAt: Date.now() + 1000 });

    const res = await GET(buildRequest());

    expect(res.status).toBe(429);
    expect(verifyAdminMock).not.toHaveBeenCalled();
  });

  it('returns the verifyAdmin error for non-admins', async () => {
    verifyAdminMock.mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));

    const res = await GET(buildRequest());

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/admin/export — payload', () => {
  it('returns a tenant-scoped JSON attachment', async () => {
    const res = await GET(buildRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    expect(res.headers.get('Content-Disposition')).toContain(`gustri-export-${TENANT_ID}`);
    expect(res.headers.get('Cache-Control')).toBe('no-store');

    const body = await res.json();
    expect(body.format_version).toBe(1);
    expect(body.tenant_id).toBe(TENANT_ID);
    expect(body.data.tenants).toEqual({ id: TENANT_ID, name: 'Cafe' });
    expect(body.counts.tenants).toBe(1);
    // Decrypted views, not raw ciphertext tables.
    expect(body.data.orders_decrypted).toBeDefined();
    expect(body.data.orders).toBeUndefined();
    expect(body.data.delivery_customers).toBeUndefined();
    // Secret-bearing tables must never appear.
    expect(body.data.qr_tokens).toBeUndefined();
    expect(body.data.staff_push_tokens).toBeUndefined();
  });

  it('redacts staff.pin_hash (projects an explicit safe column list)', async () => {
    await GET(buildRequest());

    const client = supabaseMock.value as ReturnType<typeof makeSupabase>;
    const staffSelect = client.selectCalls.find((c) => c.table === 'staff');
    expect(staffSelect).toBeDefined();
    expect(staffSelect!.cols).not.toContain('pin_hash');
    expect(staffSelect!.cols).not.toBe('*');
    // Sanity: still exports the useful columns.
    expect(staffSelect!.cols).toContain('full_name');
    expect(staffSelect!.cols).toContain('role');
  });

  it('fetches delivery_customers_decrypted via the user-context client, not the service role', async () => {
    const res = await GET(buildRequest());
    const body = await res.json();

    // Present in the payload with a decrypted phone (from the user client).
    expect(body.data.delivery_customers_decrypted).toEqual([
      { id: 'dc1', tenant_id: TENANT_ID, decrypted_phone: '+100000000' },
    ]);

    const svc = supabaseMock.value as ReturnType<typeof makeSupabase>;
    const user = userClientMock.value as ReturnType<typeof makeUserClient>;
    // NOT queried through the service role...
    expect(svc.eqCalls.every((c) => c.table !== 'delivery_customers_decrypted')).toBe(true);
    // ...but IS queried through the user client, tenant-filtered.
    expect(
      user.eqCalls.some(
        (c) =>
          c.table === 'delivery_customers_decrypted' &&
          c.col === 'tenant_id' &&
          c.val === TENANT_ID,
      ),
    ).toBe(true);
  });

  it('filters every service-role table on the verified admin tenant_id', async () => {
    await GET(buildRequest());

    const client = supabaseMock.value as ReturnType<typeof makeSupabase>;
    expect(client.eqCalls.some((c) => c.table === 'tenants' && c.col === 'id')).toBe(true);
    const tableFilters = client.eqCalls.filter((c) => c.table !== 'tenants');
    expect(tableFilters.length).toBeGreaterThan(0);
    for (const c of tableFilters) {
      expect(c.col).toBe('tenant_id');
      expect(c.val).toBe(TENANT_ID);
    }
  });
});

describe('GET /api/v1/admin/export — failure', () => {
  it('fails the whole export (500) when any table read errors', async () => {
    supabaseMock.value = makeSupabase({ errorTable: 'order_payments' });

    const res = await GET(buildRequest());

    expect(res.status).toBe(500);
  });
});
