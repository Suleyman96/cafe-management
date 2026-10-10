/**
 * Route test for POST /api/v1/admin/retention (H2).
 *
 * `run_data_retention` deletes across EVERY tenant, so it must be reachable
 * only by the GitHub Actions cron (x-cron-secret) or the platform operator —
 * NEVER by a single tenant's admin. The pre-fix code fell back to `verifyAdmin`
 * (any tenant admin). This test pins the new gate: no cron secret + not a
 * platform admin → 403, and the route no longer consults `verifyAdmin` at all.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

// The route MUST NOT import verifyAdmin anymore — provide only getSupabaseAdmin.
// The admin client exposes `.rpc()` (retention RPC) and `.schema().from()...`
// (the MED-3 ops.feature_flags kill-switch read).
const rpcMock = vi.fn();
const flagMock = vi.fn();
vi.mock('@/lib/api/verify-admin', () => ({
  getSupabaseAdmin: () => ({
    rpc: (...a: unknown[]) => rpcMock(...a),
    schema: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => flagMock(),
          }),
        }),
      }),
    }),
  }),
}));

const rateLimitMock = vi.fn();
vi.mock('@/lib/api/rate-limit', () => ({
  getRateLimitIdentifier: () => '1.2.3.4',
  rateLimit: (...a: unknown[]) => rateLimitMock(...a),
}));

const { POST } = await import('@/app/api/v1/admin/retention/route');

function req(): NextRequest {
  return {
    headers: { get: () => null },
    url: 'http://x/api/v1/admin/retention',
  } as unknown as NextRequest;
}

beforeEach(() => {
  isAuthorizedCronMock.mockReset();
  verifyPlatformAdminMock.mockReset();
  rpcMock.mockReset();
  flagMock.mockReset();
  rateLimitMock.mockReset();
  rateLimitMock.mockResolvedValue({ success: true, remaining: 30, resetAt: 0 });
  rpcMock.mockResolvedValue({ data: { deleted: 0 }, error: null });
  // Default: kill-switch ON so the auth/rate-limit assertions below exercise the
  // full run path. The "skipped" cases flip it off explicitly.
  flagMock.mockResolvedValue({ data: { enabled: true }, error: null });
});

describe('POST /api/v1/admin/retention (H2)', () => {
  it('403 when not cron-authorized and not a platform admin (no tenant-admin fallback)', async () => {
    isAuthorizedCronMock.mockReturnValue(false);
    verifyPlatformAdminMock.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden: platform access required' }, { status: 403 }),
    );
    const res = await POST(req());
    expect(res.status).toBe(403);
    // Platform gate was consulted; the retention RPC never ran.
    expect(verifyPlatformAdminMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('runs for the cron-secret caller without any user gate', async () => {
    isAuthorizedCronMock.mockReturnValue(true);
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(verifyPlatformAdminMock).not.toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledWith('run_data_retention');
  });

  it('runs for a verified platform admin', async () => {
    isAuthorizedCronMock.mockReturnValue(false);
    verifyPlatformAdminMock.mockResolvedValue({ id: 'op-1', email: 'boss@gustri.com' });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('run_data_retention');
  });

  it('429 when the platform rate limit trips', async () => {
    isAuthorizedCronMock.mockReturnValue(true);
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, resetAt: Date.now() + 1000 });
    const res = await POST(req());
    expect(res.status).toBe(429);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('MED-3: skips (200 skipped) without running the RPC when the kill-switch is OFF', async () => {
    isAuthorizedCronMock.mockReturnValue(true);
    flagMock.mockResolvedValue({ data: { enabled: false }, error: null });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ skipped: true, reason: 'retention_disabled' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('MED-3: skips when the flag row is absent (default-OFF / fail-safe)', async () => {
    isAuthorizedCronMock.mockReturnValue(true);
    flagMock.mockResolvedValue({ data: null, error: null });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ skipped: true, reason: 'retention_disabled' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('MED-3: skips when the flag read errors (fail-safe toward not deleting)', async () => {
    isAuthorizedCronMock.mockReturnValue(true);
    flagMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ skipped: true, reason: 'retention_disabled' });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
