import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from './verify-admin';

/**
 * Platform-admin (super-admin) identity — the gustri operator, distinct from
 * per-tenant `owner`/`admin` roles. Used only by the cross-tenant
 * `/api/v1/platform/*` console routes.
 *
 * Identity is an email allowlist in `PLATFORM_ADMIN_EMAILS` (comma-separated),
 * checked against the caller's *verified, confirmed* auth email. Kept out of the
 * DB on purpose: only whoever controls the Vercel env can grant platform access,
 * so a tenant can never escalate into it, and there's no table to tamper with.
 *
 * Fail-closed: if the env is unset/empty, there are NO platform admins and every
 * platform route returns 403. The console is inert until the operator sets it.
 */
function allowedEmails(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export interface PlatformAdmin {
  id: string;
  email: string;
}

/**
 * Returns the verified platform admin, or a `NextResponse` error the caller
 * returns as-is (mirrors the `verifyAdmin` contract).
 */
export async function verifyPlatformAdmin(
  request: NextRequest,
): Promise<PlatformAdmin | NextResponse> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);

  const allow = allowedEmails();
  // No allowlist configured → nobody is a platform admin (fail-closed).
  if (allow.size === 0) {
    return NextResponse.json({ error: 'Forbidden: platform access required' }, { status: 403 });
  }

  const {
    data: { user },
    error,
  } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = user.email?.toLowerCase();
  // Require a confirmed email so an unconfirmed signup can't squat an allowlisted
  // address before the real owner confirms it.
  if (!email || !user.email_confirmed_at || !allow.has(email)) {
    return NextResponse.json({ error: 'Forbidden: platform access required' }, { status: 403 });
  }

  return { id: user.id, email };
}
