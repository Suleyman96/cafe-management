/**
 * Unit test for verifyTenantClaim — focused on the tenant soft-close gate that
 * protects the service-role /api/v1/* write path (RLS covers direct reads).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }));

const { verifyTenantClaim, __resetTenantClaimCache } = await import(
  '@/lib/api/verify-tenant-claim'
);

const STAFF_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/** Fake Supabase client returning fixed rows for `tenants` / `staff`. */
function fakeClient(
  tenantRow: Record<string, unknown> | null,
  staffRow: Record<string, unknown> | null,
): SupabaseClient {
  return {
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () =>
          Promise.resolve({
            data: table === 'tenants' ? tenantRow : staffRow,
            error: null,
          }),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

beforeEach(() => {
  __resetTenantClaimCache();
});

describe('verifyTenantClaim — tenant soft-close gate', () => {
  it('returns tenant_inactive when the tenant is deactivated', async () => {
    const client = fakeClient(
      { id: TENANT_ID, is_active: false },
      { id: STAFF_ID, tenant_id: TENANT_ID },
    );
    expect(await verifyTenantClaim(STAFF_ID, TENANT_ID, client)).toBe('tenant_inactive');
  });

  it('passes (null) for an active tenant with a matching staff row', async () => {
    const client = fakeClient(
      { id: TENANT_ID, is_active: true },
      { id: STAFF_ID, tenant_id: TENANT_ID },
    );
    expect(await verifyTenantClaim(STAFF_ID, TENANT_ID, client)).toBeNull();
  });

  it('still reports invalid_tenant when the tenant row is missing', async () => {
    const client = fakeClient(null, { id: STAFF_ID, tenant_id: TENANT_ID });
    expect(await verifyTenantClaim(STAFF_ID, TENANT_ID, client)).toBe('invalid_tenant');
  });

  it('still reports mismatch when the staff row is in another tenant', async () => {
    const client = fakeClient(
      { id: TENANT_ID, is_active: true },
      { id: STAFF_ID, tenant_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
    );
    expect(await verifyTenantClaim(STAFF_ID, TENANT_ID, client)).toBe('tenant_claim_mismatch');
  });
});
