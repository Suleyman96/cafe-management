/**
 * Security test for the platform-admin gate: only a verified, confirmed,
 * allowlisted email passes; everything else is rejected, and an empty allowlist
 * means nobody is a platform admin (fail-closed).
 */

import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
vi.mock('@/lib/api/verify-admin', () => ({
  getSupabaseAdmin: () => ({ auth: { getUser: getUserMock } }),
}));

const { verifyPlatformAdmin } = await import('@/lib/api/verify-platform-admin');

function req(auth: string | null): NextRequest {
  return { headers: { get: (k: string) => (k === 'Authorization' ? auth : null) } } as NextRequest;
}
function user(email: string | null, confirmed = true) {
  return {
    data: { user: email ? { id: 'u1', email, email_confirmed_at: confirmed ? 'x' : null } : null },
    error: email ? null : { message: 'bad token' },
  };
}

const ORIG = process.env.PLATFORM_ADMIN_EMAILS;
beforeEach(() => {
  getUserMock.mockReset();
  process.env.PLATFORM_ADMIN_EMAILS = 'boss@gustri.com, ops@gustri.com';
});
afterEach(() => {
  process.env.PLATFORM_ADMIN_EMAILS = ORIG;
});

describe('verifyPlatformAdmin', () => {
  it('passes for an allowlisted, confirmed email (case-insensitive)', async () => {
    getUserMock.mockResolvedValue(user('Boss@Gustri.com'));
    const res = await verifyPlatformAdmin(req('Bearer t'));
    expect(res).toEqual({ id: 'u1', email: 'boss@gustri.com' });
  });

  it('401 without a bearer token', async () => {
    const res = await verifyPlatformAdmin(req(null));
    expect((res as Response).status).toBe(401);
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('403 when the email is not on the allowlist', async () => {
    getUserMock.mockResolvedValue(user('random@evil.com'));
    expect(((await verifyPlatformAdmin(req('Bearer t'))) as Response).status).toBe(403);
  });

  it('403 when the allowlisted email is unconfirmed', async () => {
    getUserMock.mockResolvedValue(user('boss@gustri.com', false));
    expect(((await verifyPlatformAdmin(req('Bearer t'))) as Response).status).toBe(403);
  });

  it('403 for everyone when the allowlist env is empty (fail-closed)', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = '';
    const res = await verifyPlatformAdmin(req('Bearer t'));
    expect((res as Response).status).toBe(403);
    expect(getUserMock).not.toHaveBeenCalled(); // short-circuits before hitting auth
  });

  it('401 when the token is invalid', async () => {
    getUserMock.mockResolvedValue(user(null));
    expect(((await verifyPlatformAdmin(req('Bearer bad'))) as Response).status).toBe(401);
  });
});
