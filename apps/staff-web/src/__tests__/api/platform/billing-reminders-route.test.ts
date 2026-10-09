/**
 * Route test for POST /api/v1/platform/billing-reminders.
 * Focuses on the DORMANT behavior: it computes the due list from
 * current_period_end but no-ops cleanly (never errors) when the email
 * transport / recipients are unset. Also covers the platform gate and the
 * none-due short-circuit.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  withScope: (fn: (s: { setTag: () => void }) => void) => fn({ setTag: () => {} }),
}));

vi.mock('@/lib/api/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const isAuthorizedCronMock = vi.fn();
vi.mock('@/lib/api/verify-cron-secret', () => ({
  isAuthorizedCron: (...a: unknown[]) => isAuthorizedCronMock(...a),
}));

const verifyPlatformAdminMock = vi.fn();
vi.mock('@/lib/api/verify-platform-admin', () => ({
  verifyPlatformAdmin: (...a: unknown[]) => verifyPlatformAdminMock(...a),
}));

const supabaseMock = { rows: [] as Record<string, unknown>[] };
vi.mock('@/lib/api/verify-admin', () => ({
  getSupabaseAdmin: () => ({
    from: () => {
      const builder = {
        select: () => builder,
        neq: () => builder,
        eq: () => builder,
        not: () => Promise.resolve({ data: supabaseMock.rows, error: null }),
      };
      return builder;
    },
  }),
}));

const { POST } = await import('@/app/api/v1/platform/billing-reminders/route');

function req(): NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://x/api/v1/platform/billing-reminders',
  } as unknown as NextRequest;
}

const OVERDUE = '2000-01-01T00:00:00.000Z';

beforeEach(() => {
  isAuthorizedCronMock.mockReset();
  verifyPlatformAdminMock.mockReset();
  isAuthorizedCronMock.mockReturnValue(true); // cron-authorized by default
  verifyPlatformAdminMock.mockResolvedValue({ id: 'admin-1', email: 'boss@gustri.com' });
  supabaseMock.rows = [];
  delete process.env.RESEND_API_KEY;
  delete process.env.PLATFORM_ADMIN_EMAILS;
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.PLATFORM_ADMIN_EMAILS;
});

describe('POST /api/v1/platform/billing-reminders', () => {
  it('403 when neither cron-authorized nor platform admin', async () => {
    isAuthorizedCronMock.mockReturnValue(false);
    verifyPlatformAdminMock.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    );
    expect((await POST(req())).status).toBe(403);
  });

  it('none-due short-circuit returns emailed:false reason none_due', async () => {
    supabaseMock.rows = [
      {
        id: 't1',
        name: 'Future Cafe',
        plan: 'pro',
        billing_cycle: 'yearly',
        current_period_end: '2099-01-01T00:00:00.000Z',
      },
    ];
    const res = await POST(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.emailed).toBe(false);
    expect(body.reason).toBe('none_due');
    expect(body.due).toEqual([]);
  });

  it('no-ops cleanly (does NOT error) when email transport is unconfigured', async () => {
    supabaseMock.rows = [
      {
        id: 't1',
        name: 'Overdue Cafe',
        plan: 'pro',
        billing_cycle: 'monthly',
        current_period_end: OVERDUE,
      },
    ];
    const res = await POST(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.emailed).toBe(false);
    expect(body.reason).toBe('email_not_configured');
    // The due list is still surfaced so the cron log / console retains a signal.
    expect(body.due).toHaveLength(1);
    expect(body.due[0].id).toBe('t1');
  });

  it('still no-ops when recipients exist but ESP key is missing', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'ops@gustri.com';
    supabaseMock.rows = [
      {
        id: 't1',
        name: 'Overdue Cafe',
        plan: 'pro',
        billing_cycle: 'monthly',
        current_period_end: OVERDUE,
      },
    ];
    const body = await (await POST(req())).json();
    expect(body.emailed).toBe(false);
    expect(body.reason).toBe('email_not_configured');
  });
});
