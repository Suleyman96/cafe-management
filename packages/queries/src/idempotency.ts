/**
 * Idempotency keys for replayable shared-queries create mutations.
 *
 * The mutations in `packages/queries/src/mutations/` are consumed by both
 * web (no offline replay) and mobile (persisted via MMKV). Auto-stamping
 * `client_request_id` in `onMutate` keeps the mobile-replay path safe
 * without forcing every caller to mint an id upstream. Web consumers
 * pay a few microseconds and ignore the field; if a request happens to
 * be retried in flight, they get dedupe on the server for free.
 *
 * Shared with the mobile helper at `apps/mobile/src/lib/idempotency.ts`,
 * but duplicated here so `@gustri/queries` doesn't need to depend on the
 * mobile bundle. Both paths produce RFC 4122 v4 UUIDs from `Math.random` —
 * idempotency tokens need collision resistance, not cryptographic
 * randomness. If a `crypto.getRandomValues` polyfill lands in the mobile
 * boot sequence, swap both implementations together.
 */

export function getOrCreateClientRequestId(existing?: string | null): string {
  return existing && typeof existing === 'string' ? existing : randomUUIDv4();
}

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
