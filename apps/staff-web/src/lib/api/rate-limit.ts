import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const hasRedis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

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
  | 'waiter-call'
  | 'feedback'
  | 'order-cancel'
  | 'customer-qr-token';

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
    if (ips.length > 0) return ips[ips.length - 1];
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
