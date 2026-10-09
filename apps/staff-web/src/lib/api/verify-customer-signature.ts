import {
  AuthenticationError,
  DEFAULT_SIGNATURE_TOLERANCE_MS,
  NONCE_HEADER,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyRequestSignature,
} from '@gustri/core';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { claimNonce } from './nonce-store';

// Production guardrail (M3): if the secret is unset in production, signature
// verification now FAILS CLOSED (see `verifyCustomerSignature` below) rather
// than silently passing. M2's boot gate already forces the secret to be present
// in prod, so reaching the function without it should be impossible — but if it
// ever happens we reject the request instead of accepting unsigned (spoofable)
// traffic. We still surface the misconfiguration loudly here, once per server
// instance, so it can't go unnoticed.
if (process.env.NODE_ENV === 'production' && !process.env.CUSTOMER_API_SIGNING_SECRET) {
  Sentry.captureMessage(
    'CUSTOMER_API_SIGNING_SECRET is unset in production — customer API signature verification now FAILS CLOSED (requests rejected)',
    'warning',
  );
}

/**
 * Verify the HMAC signature on a `/api/v1/customer/*` request (ADD-8).
 *
 * Customer-web's QR-ordering endpoints are unauthenticated by design; this adds
 * defense-in-depth by requiring requests to be signed by customer-web's
 * server-side BFF proxy (which holds the shared secret) rather than hit
 * staff-web directly.
 *
 * SECRET-UNSET BEHAVIOR (M3):
 *   - Production: FAIL CLOSED — reject the request. M2's boot gate already
 *     requires the secret in prod, so this path is unreachable in a correct
 *     deploy; if it is ever hit, we must not accept unsigned (spoofable)
 *     traffic.
 *   - Non-production: no-op — local dev and CI run without the secret, so the
 *     endpoint keeps its rate-limit + tenant-binding + RLS protection and
 *     ordering still works.
 * When the secret IS set (the normal prod path, set on BOTH customer-web's BFF
 * proxy and staff-web), the signed request verifies normally below.
 *
 * Reads the body off a clone so the route handler can still consume the
 * original stream (e.g. via `validateBody`).
 */
export async function verifyCustomerSignature(request: NextRequest): Promise<void> {
  const secret = process.env.CUSTOMER_API_SIGNING_SECRET;
  if (!secret) {
    // M3: fail closed in production, no-op in dev/CI.
    if (process.env.NODE_ENV === 'production') {
      throw new AuthenticationError('invalid_signature');
    }
    return;
  }

  const signature = request.headers.get(SIGNATURE_HEADER) ?? '';
  const timestamp = request.headers.get(TIMESTAMP_HEADER) ?? '';
  const nonce = request.headers.get(NONCE_HEADER) ?? '';
  const body = await request.clone().text();

  const verdict = await verifyRequestSignature({
    secret,
    signature,
    timestamp,
    nonce,
    method: request.method,
    path: new URL(request.url).pathname,
    body,
  });

  if (!verdict.valid) {
    // 401 with the `invalid_signature` sentinel — localized client-side via
    // httpStatusToAppError → localizeErrorMessage.
    throw new AuthenticationError('invalid_signature');
  }

  // Strict replay protection: the nonce is part of the verified payload, so a
  // replay carries the SAME nonce. Claim it single-use (TTL = the tolerance
  // window — a captured signature is only valid that long). A repeat is a
  // replay; 'skipped' (no Redis / transient error) falls back to the timestamp
  // window, which still bounds replay.
  if (nonce) {
    const ttlSeconds = Math.ceil(DEFAULT_SIGNATURE_TOLERANCE_MS / 1000);
    const claim = await claimNonce(nonce, ttlSeconds);
    if (claim === 'replay') {
      throw new AuthenticationError('invalid_signature');
    }
  }
}
