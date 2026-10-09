/**
 * Route test for POST /api/v1/staff (L1 — admin cannot mint an owner).
 *
 * `verifyAdmin` admits both `admin` and `owner`. Without a guard, a plain admin
 * could create a new staff member with role `owner` and escalate the org's top
 * role. Only an `owner` may grant `owner`.
 */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  withScope: (fn: (s: { setTag: () => void }) => void) => fn({ setTag: () => {} }),
}));

vi.mock('@/lib/api/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/api/password-validation', () => ({
  validatePassword: () => ({ valid: true, errors: [] }),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  getRateLimitIdentifier: () => '1.2.3.4',
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 10, resetAt: 0 }),
}));

const verifyAdminMock = vi.fn();
const createUserMock = vi.fn();
const staffInsertMock = vi.fn();

vi.mock('@/lib/api/verify-admin', () => ({
  verifyAdmin: (...a: unknown[]) => verifyAdminMock(...a),
  getSupabaseAdmin: () => ({
    auth: { admin: { createUser: (...a: unknown[]) => createUserMock(...a) } },
    from: () => ({
      insert: (vals: Record<string, unknown>) => {
        staffInsertMock(vals);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'staff-new', ...vals }, error: null }),
          }),
        };
      },
    }),
  }),
}));

const { POST } = await import('@/app/api/v1/staff/route');

const TENANT = '11111111-1111-4111-8111-111111111111';

function req(body: Record<string, unknown>): NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://x/api/v1/staff',
    json: async () => body,
  } as unknown as NextRequest;
}

const ownerBody = {
  email: 'new-owner@cafe.com',
  password: 'hunter2xZ',
  full_name: 'New Owner',
  role: 'owner',
};

beforeEach(() => {
  verifyAdminMock.mockReset();
  createUserMock.mockReset();
  staffInsertMock.mockReset();
  createUserMock.mockResolvedValue({ data: { user: { id: 'auth-new' } }, error: null });
});

describe('POST /api/v1/staff — only an owner can create an owner (L1)', () => {
  it('403 when a plain admin tries to create an owner (no auth user created)', async () => {
    verifyAdminMock.mockResolvedValue({ id: 'admin-1', role: 'admin', tenant_id: TENANT });
    const res = await POST(req(ownerBody));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('owner_role_requires_owner');
    // The escalation must be stopped before any account is provisioned.
    expect(createUserMock).not.toHaveBeenCalled();
    expect(staffInsertMock).not.toHaveBeenCalled();
  });

  it('allows an owner to create another owner', async () => {
    verifyAdminMock.mockResolvedValue({ id: 'owner-1', role: 'owner', tenant_id: TENANT });
    const res = await POST(req(ownerBody));
    expect(res.status).toBe(201);
    expect(createUserMock).toHaveBeenCalledTimes(1);
    expect(staffInsertMock).toHaveBeenCalledTimes(1);
    expect(staffInsertMock.mock.calls[0]![0].role).toBe('owner');
  });

  it('allows an admin to create a non-owner role (waiter)', async () => {
    verifyAdminMock.mockResolvedValue({ id: 'admin-1', role: 'admin', tenant_id: TENANT });
    const res = await POST(req({ ...ownerBody, email: 'w@cafe.com', role: 'waiter' }));
    expect(res.status).toBe(201);
    expect(staffInsertMock.mock.calls[0]![0].role).toBe('waiter');
  });
});
