/**
 * Idempotency keys for replayable mobile mutations.
 *
 * The persister rehydrates paused mutations after a relaunch and replays them.
 * Without a stable key, a mutation that committed server-side but lost its
 * response would create duplicate rows on replay (double order, double payment).
 * Each mutation gets a UUID v4 stamped at first attempt; the server's
 * `(tenant_id, client_request_id)` unique index turns the replay into a no-op
 * and returns the original row.
 *
 * Hermes (RN 0.81) does not ship `crypto.getRandomValues` by default, and we
 * have no polyfill. Idempotency tokens don't need cryptographic randomness —
 * just collision resistance — so we generate v4 from `Math.random`. If a
 * polyfill is added later, swap the body of `randomUUIDv4`.
 */

/**
 * Returns the existing id if truthy, otherwise mints a fresh UUID v4.
 *
 * The first call decides the value; subsequent calls during the same
 * mutation lifecycle should pass the previously-returned id back in so
 * retries reuse it. Persistence is the caller's job: stamp the result
 * onto a field that's serialized with the mutation variables (typically
 * `client_request_id` on the payload) so the persister carries it across
 * rehydration.
 */
export function getOrCreateClientRequestId(existing?: string | null): string {
  return existing && typeof existing === 'string' ? existing : randomUUIDv4();
}

/**
 * RFC 4122 v4 UUID. Not cryptographically secure — see file header.
 *
 * Layout: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 *   - position 12 fixed to '4' (version)
 *   - position 16 in {8, 9, a, b} (variant)
 */
export function randomUUIDv4(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += '-';
    } else if (i === 14) {
      out += '4';
    } else if (i === 19) {
      out += hex[((Math.random() * 4) | 0) + 8];
    } else {
      out += hex[(Math.random() * 16) | 0];
    }
  }
  return out;
}
