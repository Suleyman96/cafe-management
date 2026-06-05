import {
  AuthenticationError,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyRequestSignature,
} from '@gustri/core';
import type { NextRequest } from 'next/server';

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
  const body = await request.clone().text();

  const verdict = await verifyRequestSignature({
    secret,
    signature,
    timestamp,
    method: request.method,
    path: new URL(request.url).pathname,
    body,
  });

  if (!verdict.valid) {
    // 401 with the `invalid_signature` sentinel — localized client-side via
    // httpStatusToAppError → localizeErrorMessage.
    throw new AuthenticationError('invalid_signature');
  }
}
