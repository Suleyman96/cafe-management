import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Plan 13 — PIN hashing for the idle soft-lock. Format is a self-describing
// string `scrypt-v1:<saltB64>:<hashB64>` so future parameter rotations can
// be detected (and old hashes verified) without a separate version column.
//
// scrypt is a built-in Node KDF — no external dep. Cost factor N=2^14 ~50ms
// per attempt on a modern server, which makes a brute force on a 4-digit PIN
// take ~8min in the worst case (10000 * 0.05s) and 6-digit PIN ~14h. Combined
// with the per-IP rate limit on /api/v1/staff/verify-pin (5 attempts / 5min),
// online attacks are not practical and offline attacks need the DB.

const PARAM_VERSION = 'scrypt-v1';
const KEY_LEN = 32;
const SALT_LEN = 16;
const SCRYPT_COST = 16384; // 2^14

export function hashPin(pin: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(pin, salt, KEY_LEN, { N: SCRYPT_COST });
  return `${PARAM_VERSION}:${salt.toString('base64')}:${hash.toString('base64')}`;
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== PARAM_VERSION) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    // parts.length === 3 verified above, so [1] and [2] are present
    salt = Buffer.from(parts[1]!, 'base64');
    expected = Buffer.from(parts[2]!, 'base64');
  } catch {
    return false;
  }
  if (expected.length !== KEY_LEN) return false;
  const actual = scryptSync(pin, salt, KEY_LEN, { N: SCRYPT_COST });
  return timingSafeEqual(expected, actual);
}
