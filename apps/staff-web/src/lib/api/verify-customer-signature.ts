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

// Production guardrail: if the secret is unset in production, signature
// verification is silently disabled — the audit's "fail-open has no prod
// guardrail" gap. We do NOT fail closed (that would take down customer ordering
// the moment the secret is missing during a partial rollout; the endpoints
// still have rate-limit + tenant-binding + RLS underneath). Instead we surface
// the misconfiguration loudly, once per server instance, so it can't go
// unnoticed.
if (process.env.NODE_ENV === 'production' && !process.env.CUSTOMER_API_SIGNING_SECRET) {
  Sentry.captureMessage(
    'CUSTOMER_API_SIGNING_SECRET is unset in production — customer API signature verification is DISABLED (defense-in-depth layer off)',
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
 * SAFE DEFAULT: if `CUSTOMER_API_SIGNING_SECRET` is not configured, verification
 * is a no-op — the endpoint keeps its current (rate-limit + tenant-binding +
 * RLS) protection. This lets the feature roll out without a deploy-coupled
 * break: enforcement turns on only once the secret is set on BOTH the proxy and
 * staff-web. Misconfiguring one side without the other therefore fails closed
 * *only* when you've opted in by setting the secret here.
 *
 * Reads the body off a clone so the route handler can still consume the
 * original stream (e.g. via `validateBody`).
 */
export async function verifyCustomerSignature(request: NextRequest): Promise<void> {
  const secret = process.env.CUSTOMER_API_SIGNING_SECRET;
  if (!secret) return;

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
