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
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}
