import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const limiters = {
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
};

export type RateLimitCategory = keyof typeof limiters;

export async function rateLimit(
  category: RateLimitCategory,
  identifier: string,
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const result = await limiters[category].limit(identifier);
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
