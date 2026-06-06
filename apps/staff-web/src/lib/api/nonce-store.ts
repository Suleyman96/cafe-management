import { Redis } from '@upstash/redis';

/**
 * Single-use nonce store for strict replay protection on signed customer
 * requests (ADD-8). Backed by Upstash Redis (the same instance the rate
 * limiter uses), with a short TTL equal to the signature tolerance window — a
 * captured signature is only replayable within that window anyway, so the nonce
 * never needs to be remembered longer.
 *
 * When Redis is not configured (local dev / CI without Upstash env) the store
 * is a no-op: `claimNonce` returns `'skipped'` and verification falls back to
 * the timestamp window alone. Strict replay protection is therefore a
 * production-only hardening that layers on top of, never replaces, the window.
 */
const hasRedis = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

export type NonceClaim = 'fresh' | 'replay' | 'skipped';

/**
 * Atomically claim a nonce for single use within `ttlSeconds`.
 *
 * - `'fresh'`   — first time this nonce was seen; it is now recorded.
 * - `'replay'`  — already claimed within the window → the caller must reject.
 * - `'skipped'` — no store configured (or a transient Redis error). Fail OPEN:
 *   the signature + timestamp window still apply, and we don't want a Redis
 *   hiccup to take down customer ordering.
 */
export async function claimNonce(nonce: string, ttlSeconds: number): Promise<NonceClaim> {
  if (!redis || !nonce) return 'skipped';
  try {
    // SET key 1 NX EX ttl → 'OK' when newly set, null when the key already
    // exists. Atomic, so two concurrent replays can't both win.
    const res = await redis.set(`sig-nonce:${nonce}`, 1, { nx: true, ex: ttlSeconds });
    return res === 'OK' ? 'fresh' : 'replay';
  } catch {
    return 'skipped';
  }
}
