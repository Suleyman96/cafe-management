import { computeRequestSignature, SIGNATURE_HEADER, TIMESTAMP_HEADER } from '@gustri/core';
import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyCustomerSignature } from '@/lib/api/verify-customer-signature';

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

async function signedHeaders(body: string, now = Date.now()): Promise<Record<string, string>> {
  const timestamp = now.toString();
  const signature = await computeRequestSignature({
    secret: SECRET,
    timestamp,
    method: 'POST',
    path: PATH,
    body,
  });
  return { [TIMESTAMP_HEADER]: timestamp, [SIGNATURE_HEADER]: signature };
}

const originalSecret = process.env.CUSTOMER_API_SIGNING_SECRET;
afterEach(() => {
  // Assigning `undefined` would coerce to the string "undefined" (truthy) —
  // delete to truly unset.
  if (originalSecret === undefined) delete process.env.CUSTOMER_API_SIGNING_SECRET;
  else process.env.CUSTOMER_API_SIGNING_SECRET = originalSecret;
});

describe('verifyCustomerSignature (ADD-8)', () => {
  describe('when the secret is not configured (safe default)', () => {
    beforeEach(() => {
      delete process.env.CUSTOMER_API_SIGNING_SECRET;
    });

    it('is a no-op even with no signature headers', async () => {
      await expect(verifyCustomerSignature(makeRequest('{}'))).resolves.toBeUndefined();
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
  });
});
