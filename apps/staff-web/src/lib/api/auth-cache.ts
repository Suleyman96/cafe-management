import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';

/**
 * Short-TTL Upstash cache for verified-auth results from `verifyStaff` /
 * `verifyAdmin`.
 *
 * Without this, every `/api/v1/*` call paid two round-trips to Supabase
 * before its actual work: `auth.getUser(token)` (network) and a
 * `verifyTenantClaim` SELECT against `staff` / `tenants`. From distant
 * regions (e.g. Azerbaijan → Supabase Tokyo, ~250ms RTT) that's ~500ms
 * of pure auth overhead per call.
 *
 * The cache stores the verified result keyed by the **hash** of the
 * Bearer token (sha256, 16-hex-char prefix). Redis only ever sees the
 * hash, never the token itself, so a Redis read leak doesn't expose
 * usable credentials. The 64-bit prefix is collision-resistant for our
 * cardinality (worst case: a few thousand active tokens at any time).
 *
 * TTL of 30s is the trust window: a token revoked at the Supabase auth
 * layer can still hit `/api/v1/*` for up to 30s after revocation. This
 * is acceptable because:
 *
 *   1. The same window already exists at the JWT layer — Supabase
 *      access tokens are valid until `exp` regardless of what `auth.users`
 *      or `staff` says.
 *   2. `revoke-sessions` invalidates the *refresh* token, not the
 *      access token. The cache adds at most 30s on top of the access
 *      token's natural lifetime (jwt_expiry = 3600s).
 *   3. `is_active = false` flows through the JWT via the
 *      `custom_access_token_hook`, but only on the *next* token refresh.
 *
 * In short: the cache doesn't widen the existing post-revoke window in
 * any meaningful way.
 *
 * Cache writes are best-effort. A Redis outage produces a silent miss
 * (live verification runs). A Redis write failure is dropped silently.
 * Auth must never break because the cache is unreachable.
 */

const hasRedis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

const TTL_SECONDS = 30;
const KEY_PREFIX = 'auth:';

export interface CachedAuth {
  id: string;
  role: string;
  tenant_id: string;
}

function tokenKey(token: string): string {
  const digest = createHash('sha256').update(token).digest('hex').slice(0, 16);
  return `${KEY_PREFIX}${digest}`;
}

export async function getCachedAuth(token: string): Promise<CachedAuth | null> {
  if (!redis) return null;
  try {
    return await redis.get<CachedAuth>(tokenKey(token));
  } catch {
    return null;
  }
}

export async function setCachedAuth(token: string, auth: CachedAuth): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(tokenKey(token), auth, { ex: TTL_SECONDS });
  } catch {
    // Best-effort write — fall through.
  }
}
