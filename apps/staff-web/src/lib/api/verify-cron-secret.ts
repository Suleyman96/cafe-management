import { timingSafeEqual } from 'node:crypto';

/**
 * Authorize an internal scheduler (e.g. the `data-retention` GitHub Actions
 * cron) to invoke a cron-style endpoint WITHOUT a user session, via a shared
 * secret in the `x-cron-secret` header.
 *
 * A distinct header (not `Authorization`) is used so a scheduler call can't be
 * confused with an admin user's Bearer JWT — the two auth paths stay cleanly
 * separated.
 *
 * SAFE DEFAULT: returns `false` when `CRON_SECRET` is unset, so the endpoint
 * keeps its admin-only behavior until the secret is configured on BOTH the
 * scheduler and the deployment. Misconfiguring one side fails closed.
 *
 * The compare is constant-time (length-guarded) to avoid leaking the secret
 * through a timing side-channel. Runs in the Node runtime (the consuming routes
 * use the service-role client), where `node:crypto` is available.
 */
export function isAuthorizedCron(request: {
  headers: { get(name: string): string | null };
}): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const provided = request.headers.get('x-cron-secret') ?? '';
  if (provided.length === 0) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  // Length mismatch can't be constant-time-compared by timingSafeEqual (it
  // throws); a differing length is already a mismatch.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
