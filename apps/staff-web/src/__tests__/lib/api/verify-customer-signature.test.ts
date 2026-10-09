import {
  computeRequestSignature,
  NONCE_HEADER,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
} from '@gustri/core';
import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const claimNonceMock = vi.fn();
vi.mock('@/lib/api/nonce-store', () => ({
  claimNonce: (...args: unknown[]) => claimNonceMock(...args),
}));

const { verifyCustomerSignature } = await import('@/lib/api/verify-customer-signature');

const SECRET = 'unit-test-secret';
const URL_STR = 'http://localhost:3001/api/v1/customer/orders';
const PATH = '/api/v1/customer/orders';

function makeRequest(body: string, headers: Record<string, string> = {}): NextRequest {
  return new Request(URL_STR, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  }) as unknown as NextRequest;
}

async function signedHeaders(
  body: string,
  now = Date.now(),
  nonce?: string,
): Promise<Record<string, string>> {
  const timestamp = now.toString();
  const signature = await computeRequestSignature({
    secret: SECRET,
    timestamp,
    method: 'POST',
    path: PATH,
    body,
    nonce,
  });
  const headers: Record<string, string> = {
    [TIMESTAMP_HEADER]: timestamp,
    [SIGNATURE_HEADER]: signature,
  };
  if (nonce) headers[NONCE_HEADER] = nonce;
  return headers;
}

const originalSecret = process.env.CUSTOMER_API_SIGNING_SECRET;
afterEach(() => {
  // Assigning `undefined` would coerce to the string "undefined" (truthy) —
  // delete to truly unset.
  if (originalSecret === undefined) delete process.env.CUSTOMER_API_SIGNING_SECRET;
  else process.env.CUSTOMER_API_SIGNING_SECRET = originalSecret;
});

describe('verifyCustomerSignature (ADD-8)', () => {
  beforeEach(() => {
    // Default: nonce store treats every nonce as fresh. Replay tests override.
    claimNonceMock.mockReset();
    claimNonceMock.mockResolvedValue('fresh');
  });

  describe('when the secret is not configured', () => {
    beforeEach(() => {
      delete process.env.CUSTOMER_API_SIGNING_SECRET;
    });

    it('is a no-op in non-production (dev/CI) even with no signature headers', async () => {
      await expect(verifyCustomerSignature(makeRequest('{}'))).resolves.toBeUndefined();
    });

    it('fails closed in production — rejects with invalid_signature (M3)', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      // The function reads NODE_ENV at call time, so toggling it here exercises
      // the production fail-closed branch without a module re-import.
      vi.stubEnv('NODE_ENV', 'production');
      try {
        await expect(verifyCustomerSignature(makeRequest('{}'))).rejects.toMatchObject({
          message: 'invalid_signature',
          statusCode: 401,
        });
      } finally {
        vi.stubEnv('NODE_ENV', originalNodeEnv ?? 'test');
      }
    });
  });

  describe('when the secret is configured (enforced)', () => {
    beforeEach(() => {
      process.env.CUSTOMER_API_SIGNING_SECRET = SECRET;
    });

    it('accepts a correctly signed request', async () => {
      const body = '{"table_id":"t1"}';
      await expect(
        verifyCustomerSignature(makeRequest(body, await signedHeaders(body))),
      ).resolves.toBeUndefined();
    });

    it('still accepts a correctly signed request in production (M3 fail-closed does not reject valid traffic)', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      vi.stubEnv('NODE_ENV', 'production');
      try {
        const body = '{"table_id":"t1"}';
        await expect(
          verifyCustomerSignature(makeRequest(body, await signedHeaders(body))),
        ).resolves.toBeUndefined();
      } finally {
        vi.stubEnv('NODE_ENV', originalNodeEnv ?? 'test');
      }
    });

    it('rejects a request with no signature headers', async () => {
      await expect(verifyCustomerSignature(makeRequest('{}'))).rejects.toMatchObject({
        message: 'invalid_signature',
        statusCode: 401,
      });
    });

    it('rejects a tampered body (signature no longer matches)', async () => {
      const signed = await signedHeaders('{"table_id":"t1"}');
      // body differs from what was signed
      await expect(
        verifyCustomerSignature(makeRequest('{"table_id":"evil"}', signed)),
      ).rejects.toMatchObject({ message: 'invalid_signature' });
    });

    it('rejects an expired timestamp', async () => {
      const body = '{"table_id":"t1"}';
      const stale = await signedHeaders(body, Date.now() - 10 * 60 * 1000); // 10 min old
      await expect(verifyCustomerSignature(makeRequest(body, stale))).rejects.toMatchObject({
        message: 'invalid_signature',
      });
    });

    it('reads the body off a clone (does not consume the original stream)', async () => {
      const body = '{"table_id":"t1"}';
      const req = makeRequest(body, await signedHeaders(body));
      await verifyCustomerSignature(req);
      // The route handler must still be able to read the body afterwards.
      await expect(req.text()).resolves.toBe(body);
    });

    describe('nonce / strict replay protection', () => {
      it('accepts a nonce-signed request and claims the nonce single-use', async () => {
        const body = '{"table_id":"t1"}';
        const headers = await signedHeaders(body, Date.now(), 'nonce-abc');
        await expect(verifyCustomerSignature(makeRequest(body, headers))).resolves.toBeUndefined();
        expect(claimNonceMock).toHaveBeenCalledWith('nonce-abc', expect.any(Number));
      });

      it('rejects a replayed request (nonce already claimed)', async () => {
        claimNonceMock.mockResolvedValue('replay');
        const body = '{"table_id":"t1"}';
        const headers = await signedHeaders(body, Date.now(), 'nonce-replay');
        await expect(verifyCustomerSignature(makeRequest(body, headers))).rejects.toMatchObject({
          message: 'invalid_signature',
        });
      });

      it('allows when the nonce store is skipped (no Redis) — window still applies', async () => {
        claimNonceMock.mockResolvedValue('skipped');
        const body = '{"table_id":"t1"}';
        const headers = await signedHeaders(body, Date.now(), 'nonce-skip');
        await expect(verifyCustomerSignature(makeRequest(body, headers))).resolves.toBeUndefined();
      });

      it('rejects a nonce swapped on a captured signature (signature no longer matches)', async () => {
        const body = '{"table_id":"t1"}';
        const headers = await signedHeaders(body, Date.now(), 'nonce-real');
        // Attacker swaps the nonce header but keeps the captured signature.
        headers[NONCE_HEADER] = 'nonce-forged';
        await expect(verifyCustomerSignature(makeRequest(body, headers))).rejects.toMatchObject({
          message: 'invalid_signature',
        });
        // Signature check fails before we ever claim the (forged) nonce.
        expect(claimNonceMock).not.toHaveBeenCalled();
      });
    });
  });
});
