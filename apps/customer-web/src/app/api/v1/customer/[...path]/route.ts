import {
  computeRequestSignature,
  NONCE_HEADER,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
} from '@gustri/core';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Server-side BFF proxy for customer→staff API calls (ADD-8).
 *
 * The browser posts to this same-origin route (`/api/v1/customer/*`) instead of
 * hitting staff-web cross-origin. Here — on the server, where the secret is
 * actually secret — we HMAC-sign the request and forward it to staff-web, which
 * verifies the signature. This is the whole point of the BFF indirection: a
 * signing secret shipped to the browser would be public and worthless, so the
 * signature is computed server-side with a server-only env var.
 *
 * Safe default: if `CUSTOMER_API_SIGNING_SECRET` is unset (e.g. local dev), we
 * still forward — just unsigned — and staff-web (also seeing no secret) skips
 * verification. Enforcement is symmetric: set the same secret on both sides.
 *
 * Scope: this route lives under `/api/v1/customer/`, so the catch-all only ever
 * forwards to that prefix upstream — it can't be coerced into an open relay.
 */

export const dynamic = 'force-dynamic';

// Server-only upstream. Falls back to the (browser-exposed) API base, then dev
// localhost, so existing single-env deployments keep working.
const UPSTREAM =
  process.env.CUSTOMER_API_UPSTREAM_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '');

/**
 * Best-effort real client IP, forwarded to staff-web so its per-IP rate limit
 * keys on the customer rather than on this proxy's single server IP.
 *
 * TRUST MODEL: `x-real-ip` and `x-forwarded-for` are only trustworthy because
 * the hosting platform (Vercel) sets them at the edge, OVERWRITING any value a
 * browser tried to send. On such a platform a client cannot spoof its rate-limit
 * key. If this app is ever deployed behind infrastructure that does NOT
 * normalize these headers (a bare reverse proxy passing client-supplied
 * `x-real-ip`/`x-forwarded-for` through), the edge MUST be configured to strip
 * inbound forwarding headers — otherwise an attacker could rotate the header to
 * bypass the limiter. For the XFF fallback we take the LAST hop (added by the
 * trusted proxy) rather than the first (client-controllable), matching
 * staff-web's getRateLimitIdentifier trust model.
 */
function clientIp(request: NextRequest): string | null {
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    const ips = fwd
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ips.length > 0) return ips[ips.length - 1] ?? null;
  }
  return null;
}

// L5 — segments allowed in the catch-all path. Alphanumerics plus `.`, `_`,
// `-`; crucially this rejects `/`, `\`, `%`, null bytes, and the `.`/`..`
// dot-segments. Even though Next normalizes most traversal before we see it,
// validating here provably confines the proxy to the `/api/v1/customer/`
// prefix regardless of upstream normalization quirks.
const PATH_SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

function isSafeSegment(segment: string): boolean {
  if (segment === '.' || segment === '..') return false;
  return PATH_SEGMENT_RE.test(segment);
}

async function proxy(request: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  if (!UPSTREAM) {
    return NextResponse.json({ error: 'upstream_not_configured' }, { status: 500 });
  }

  // L5 — reject any traversal or otherwise malformed segment before it can
  // influence the upstream URL. An empty catch-all or any bad segment is a 400.
  if (pathSegments.length === 0 || !pathSegments.every(isSafeSegment)) {
    return NextResponse.json({ error: 'invalid_path' }, { status: 400 });
  }

  const upstreamPath = `/api/v1/customer/${pathSegments.join('/')}`;
  const search = request.nextUrl.search; // preserve any query string
  const url = `${UPSTREAM}${upstreamPath}${search}`;
  const body = await request.text();
  const method = request.method;

  const headers: Record<string, string> = {
    'content-type': request.headers.get('content-type') ?? 'application/json',
  };

  // Propagate the correlation ID (ADD-9) so the request keeps one id end-to-end.
  const incomingRequestId = request.headers.get('x-request-id');
  if (incomingRequestId) headers['x-request-id'] = incomingRequestId;

  // Forward the real client IP for staff-web's rate limiter.
  const ip = clientIp(request);
  if (ip) {
    headers['x-real-ip'] = ip;
    headers['x-forwarded-for'] = ip;
  }

  // Sign when configured. Bind timestamp + method + upstream path + body + a
  // fresh single-use nonce so a captured signature can't be replayed on another
  // endpoint, after the window, or at all (staff-web records the nonce).
  const secret = process.env.CUSTOMER_API_SIGNING_SECRET;
  if (secret) {
    const timestamp = Date.now().toString();
    const nonce = crypto.randomUUID();
    const signature = await computeRequestSignature({
      secret,
      timestamp,
      method,
      path: upstreamPath,
      body,
      nonce,
    });
    headers[TIMESTAMP_HEADER] = timestamp;
    headers[NONCE_HEADER] = nonce;
    headers[SIGNATURE_HEADER] = signature;
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(url, {
      method,
      headers,
      body: body.length > 0 ? body : undefined,
      redirect: 'manual',
    });
  } catch {
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 });
  }

  // Mirror the upstream status + body. Pass through the correlation +
  // retry-after headers the client cares about.
  const text = await upstreamRes.text();
  const res = new NextResponse(text, {
    status: upstreamRes.status,
    headers: { 'content-type': upstreamRes.headers.get('content-type') ?? 'application/json' },
  });
  const requestId = upstreamRes.headers.get('x-request-id');
  if (requestId) res.headers.set('x-request-id', requestId);
  const retryAfter = upstreamRes.headers.get('retry-after');
  if (retryAfter) res.headers.set('retry-after', retryAfter);
  return res;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(request, path);
}
