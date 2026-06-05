/**
 * HMAC request signing for the customer→staff API (ADD-8).
 *
 * Customer-web's QR-ordering endpoints (`/api/v1/customer/*`) are
 * unauthenticated by design. For defense-in-depth, customer-web's server-side
 * BFF proxy signs each forwarded request with a deployment-level shared secret
 * and staff-web verifies the signature before processing. This authenticates
 * "the request came through our customer-web deployment" and adds tamper- and
 * replay-resistance on top of the existing IP rate-limit + tenant-binding + RLS.
 *
 * IMPORTANT: the secret is *server-side only* (customer-web BFF + staff-web).
 * It must never be exposed to the browser (no `NEXT_PUBLIC_` prefix) — a
 * browser-held secret would be readable by anyone and provide no security.
 *
 * Headless + cross-runtime: uses the Web Crypto API (`crypto.subtle`), which is
 * available in Node 18+, the Edge runtime, and browsers. `crypto` is read
 * lazily inside the functions so merely importing this module never touches a
 * global that a non-supporting runtime (e.g. React Native) lacks — RN never
 * calls these.
 */

export const SIGNATURE_HEADER = 'x-gustri-signature';
export const TIMESTAMP_HEADER = 'x-gustri-timestamp';

/** Default replay window: a request is rejected if its timestamp is more than
 *  this far from the verifier's clock (in either direction). */
export const DEFAULT_SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

const textEncoder = new TextEncoder();

function getSubtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is unavailable in this runtime');
  }
  return c.subtle;
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Constant-time comparison of two hex strings. Returns false immediately on a
 * length mismatch (lengths aren't secret), otherwise accumulates the XOR of
 * every char-code so the time taken does not depend on *where* the strings
 * first differ — defeating timing side-channels on the signature compare.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface SignatureInput {
  /** Server-only shared secret. */
  secret: string;
  /** Unix epoch milliseconds (as a string), when the request was signed. */
  timestamp: string;
  /** HTTP method, e.g. `POST`. Case-insensitive; normalized to upper. */
  method: string;
  /** Upstream request path, e.g. `/api/v1/customer/orders` (no query string). */
  path: string;
  /** Raw request body string (`''` for bodyless requests). */
  body: string;
}

/** Build the canonical string that gets HMAC'd. Binding method+path+timestamp
 *  (not just the body) stops a captured signature being replayed against a
 *  different endpoint or after the window. */
function canonicalString(input: Omit<SignatureInput, 'secret'>): string {
  return `${input.timestamp}.${input.method.toUpperCase()}.${input.path}.${input.body}`;
}

/** Compute the hex HMAC-SHA256 signature for a request. */
export async function computeRequestSignature(input: SignatureInput): Promise<string> {
  const subtle = getSubtle();
  const key = await subtle.importKey(
    'raw',
    textEncoder.encode(input.secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await subtle.sign('HMAC', key, textEncoder.encode(canonicalString(input)));
  return bufferToHex(signature);
}

export type SignatureVerdict =
  | { valid: true }
  | {
      valid: false;
      reason: 'missing' | 'bad_timestamp' | 'expired' | 'mismatch';
    };

/**
 * Verify a request signature: checks the timestamp is within tolerance, then
 * recomputes the HMAC and compares in constant time. `now` is injectable for
 * deterministic tests; it defaults to the wall clock.
 */
export async function verifyRequestSignature(
  input: SignatureInput & { signature: string; toleranceMs?: number; now?: number },
): Promise<SignatureVerdict> {
  if (!input.signature || !input.timestamp) {
    return { valid: false, reason: 'missing' };
  }
  const ts = Number(input.timestamp);
  if (!Number.isFinite(ts)) {
    return { valid: false, reason: 'bad_timestamp' };
  }
  const now = input.now ?? Date.now();
  const tolerance = input.toleranceMs ?? DEFAULT_SIGNATURE_TOLERANCE_MS;
  if (Math.abs(now - ts) > tolerance) {
    return { valid: false, reason: 'expired' };
  }
  const expected = await computeRequestSignature(input);
  return timingSafeEqualHex(expected, input.signature)
    ? { valid: true }
    : { valid: false, reason: 'mismatch' };
}
