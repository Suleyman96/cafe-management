import type { User } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { getStaffClaims } from '@/lib/api/jwt-claims';

// getStaffClaims decodes the base64 JSON of a JWT's payload segment. The token
// signature is verified upstream by auth.getUser(); these tests cover the
// shape/validity guard, not signature trust.
const fakeUser = {} as User;

function makeToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `header.${body}.signature`;
}

const validPayload = {
  staff_id: 'staff-1',
  tenant_id: 'tenant-1',
  user_role: 'admin',
  is_active_staff: true,
};

describe('getStaffClaims', () => {
  it('returns claims for a well-formed active-staff payload', () => {
    expect(getStaffClaims(fakeUser, makeToken(validPayload))).toEqual(validPayload);
  });

  it('returns null when is_active_staff is false', () => {
    expect(
      getStaffClaims(fakeUser, makeToken({ ...validPayload, is_active_staff: false })),
    ).toBeNull();
  });

  it('returns null when tenant_id is missing (tenant-isolation guard)', () => {
    const token = makeToken({ staff_id: 'staff-1', user_role: 'admin', is_active_staff: true });
    expect(getStaffClaims(fakeUser, token)).toBeNull();
  });

  it('returns null when tenant_id is null', () => {
    expect(getStaffClaims(fakeUser, makeToken({ ...validPayload, tenant_id: null }))).toBeNull();
  });

  it('returns null when staff_id is missing', () => {
    const token = makeToken({ tenant_id: 'tenant-1', user_role: 'admin', is_active_staff: true });
    expect(getStaffClaims(fakeUser, token)).toBeNull();
  });

  it('returns null for an unknown user_role', () => {
    expect(
      getStaffClaims(fakeUser, makeToken({ ...validPayload, user_role: 'superuser' })),
    ).toBeNull();
  });

  it('accepts every known role', () => {
    for (const role of ['waiter', 'admin', 'kitchen', 'owner']) {
      const claims = getStaffClaims(fakeUser, makeToken({ ...validPayload, user_role: role }));
      expect(claims?.user_role).toBe(role);
    }
  });

  it('returns null for a malformed token', () => {
    expect(getStaffClaims(fakeUser, 'not-a-jwt')).toBeNull();
  });
});
