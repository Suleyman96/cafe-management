import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const hasRedis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

// Rate limiting is a no-op without Upstash (fine in dev). In production that
// means EVERY bucket — login, staff-create, password-reset — silently allows
// unlimited attempts, so a misconfigured deploy must be loud, not silent.
if (!hasRedis && process.env.NODE_ENV === 'production') {
  console.error(
    '[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN are unset in production — ' +
      'all rate limiting is DISABLED (fail-open). Set both env vars to restore throttling.',
  );
}

const redis = hasRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

const limiters = redis
  ? {
      'order-create': new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '60 s'),
        prefix: 'rl:order-create',
      }),
      payment: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '60 s'),
        prefix: 'rl:payment',
      }),
      discount: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '60 s'),
        prefix: 'rl:discount',
      }),
      staff: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '60 s'),
        prefix: 'rl:staff',
      }),
      'password-reset': new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '300 s'),
        prefix: 'rl:password-reset',
      }),
      'push-token-revoke': new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '60 s'),
        prefix: 'rl:push-token-revoke',
      }),
      'staff-pin-verify': new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '300 s'),
        prefix: 'rl:staff-pin-verify',
      }),
      // C3: revoke-sessions is admin-only and rare in practice (fired
      // employee, suspected credential leak). 10/min per IP comfortably
      // covers a sweep of multiple staff in one sitting; anything past
      // that is suspicious enough to throttle.
      'revoke-sessions': new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '60 s'),
        prefix: 'rl:revoke-sessions',
      }),
      // Customer-facing engagement writes (H1). The pre-PR3 path went
      // straight to Supabase via the wrapper with no edge gate; an
      // attacker holding a single QR-code value could spam thousands of
      // pending calls per minute and overload the kitchen dashboard.
      // Limits are generous so a real busy-table burst (a server
      // tapping "call" multiple times during a rush) doesn't trip them
      // — anything past these numbers is unambiguous abuse.
      'waiter-call': new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '60 s'),
        prefix: 'rl:waiter-call',
      }),
      feedback: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, '300 s'),
        prefix: 'rl:feedback',
      }),
      // M6: customer-side cancel-order endpoint. Cancellation is rare
      // per legitimate customer (1 per order at most), so 5/60s is
      // generous; anything past that is unambiguous abuse — most
      // likely an attacker who scraped order_id + table_id and is
      // griefing.
      'order-cancel': new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '60 s'),
        prefix: 'rl:order-cancel',
      }),
      // SSR-multi-tenant fix: customer-web hits this once on the
      // /delivery → /delivery/menu transition to validate the qr_token
      // and bind tenant context to the wrapper. Legitimate customers
      // call it at most a handful of times per session (initial visit
      // + back-nav refreshes); anything past 10/min is a brute-force
      // probe against the qr_token namespace.
      'customer-qr-token': new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '60 s'),
        prefix: 'rl:customer-qr-token',
      }),
      // GDPR data-portability export: dumps the tenant's entire dataset in one
      // request (heavy read across ~25 tables). A legitimate admin runs this a
      // handful of times ever; 3/5min per IP leaves room for a retry after a
      // dropped download without letting the endpoint be used to hammer the DB.
      'data-export': new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, '300 s'),
        prefix: 'rl:data-export',
      }),
      // Cafe-scoped login (/c/{slug}). Unlike password sign-in (throttled by
      // Supabase Auth), this action does a PRE-auth service-role resolution
      // (slug → tenant → staff) that Supabase never sees — so it needs its own
      // throttle. Keyed PER-ACCOUNT (ip+slug+username): 10/min bounds password
      // brute-force against a single account. It must NOT be keyed on IP alone —
      // a restaurant's staff all sign in from one shared/NAT IP, so an IP-only
      // bucket locks the whole cafe out at shift change.
      login: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '60 s'),
        prefix: 'rl:login',
      }),
      // Coarse per-IP companion to `login`: bounds total pre-auth resolution
      // load / username enumeration from one IP without blocking legitimate
      // shift-change bursts. 60/min comfortably covers a large cafe's staff all
      // logging in at once; well past that from one IP is abuse.
      'login-ip': new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, '60 s'),
        prefix: 'rl:login-ip',
      }),
      // Platform-operator mutations (M1/M9/H2): cross-tenant console actions —
      // data-retention sweep, db-stats telemetry, tenant plan/status changes.
      // Keyed per operator (admin id) where an admin identity exists, by IP on
      // the cron-authorized retention path. These are rare, high-privilege
      // actions; 30/min is generous for a human operator working the console
      // and tight enough to bound a compromised token.
      platform: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '60 s'),
        prefix: 'rl:platform',
      }),
      // Shift-time operational writes (L4): waiter reassignment, clock in/out,
      // push-token registration, table QR rotation. Keyed per IP. A cafe's
      // staff share one NAT IP, so the ceiling is generous (60/min) to avoid
      // locking a whole floor out during a shift-change burst while still
      // bounding automated abuse.
      'shift-op': new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, '60 s'),
        prefix: 'rl:shift-op',
      }),
    }
  : null;

export type RateLimitCategory =
  | 'order-create'
  | 'payment'
  | 'discount'
  | 'staff'
  | 'password-reset'
  | 'push-token-revoke'
  | 'staff-pin-verify'
  | 'revoke-sessions'
  | 'waiter-call'
  | 'feedback'
  | 'order-cancel'
  | 'customer-qr-token'
  | 'data-export'
  | 'login'
  | 'login-ip'
  | 'platform'
  | 'shift-op';

export async function rateLimit(
  category: RateLimitCategory,
  identifier: string,
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  // Skip rate limiting in development when Upstash is not configured
  if (!hasRedis) {
    return { success: true, remaining: 999, resetAt: 0 };
  }

  const result = await limiters![category].limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    resetAt: result.reset,
  };
}

export function getRateLimitIdentifier(request: Request): string {
  // Prefer x-real-ip (set by Vercel, reliable single IP)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  // Fallback: last IP in x-forwarded-for is the one added by the trusted proxy.
  // First IP is attacker-controllable via header spoofing.
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    // length > 0 checked, so the last element is present
    if (ips.length > 0) return ips[ips.length - 1]!;
  }

  // Fallback: use Authorization header hash to isolate per-session.
  // Prevents one anonymous client from exhausting the limit for all.
  const auth = request.headers.get('authorization');
  if (auth) {
    let hash = 0;
    for (let i = 0; i < auth.length; i++) {
      hash = ((hash << 5) - hash + auth.charCodeAt(i)) | 0;
    }
    return `session:${hash}`;
  }

  // Vercel always sets x-real-ip. This fallback is for local dev / non-Vercel hosting.
  return 'unknown';
}
