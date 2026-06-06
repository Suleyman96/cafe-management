import { describe, expect, it } from 'vitest';
import {
  computeRequestSignature,
  DEFAULT_SIGNATURE_TOLERANCE_MS,
  timingSafeEqualHex,
  verifyRequestSignature,
} from '../signing';

const SECRET = 'test-deployment-secret';
const base = {
  secret: SECRET,
  timestamp: '1700000000000',
  method: 'POST',
  path: '/api/v1/customer/orders',
  body: '{"table_id":"t1"}',
};

describe('computeRequestSignature', () => {
  it('is deterministic for identical input', async () => {
    const a = await computeRequestSignature(base);
    const b = await computeRequestSignature(base);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/); // hex SHA-256
  });

  it('changes when any signed field changes', async () => {
    const sig = await computeRequestSignature(base);
    expect(await computeRequestSignature({ ...base, body: '{"table_id":"t2"}' })).not.toBe(sig);
    expect(await computeRequestSignature({ ...base, path: '/api/v1/customer/feedback' })).not.toBe(
      sig,
    );
    expect(await computeRequestSignature({ ...base, timestamp: '1700000000001' })).not.toBe(sig);
    expect(await computeRequestSignature({ ...base, method: 'GET' })).not.toBe(sig);
    expect(await computeRequestSignature({ ...base, secret: 'other' })).not.toBe(sig);
    // The nonce is part of the signed payload — a swapped nonce changes the sig.
    expect(await computeRequestSignature({ ...base, nonce: 'n1' })).not.toBe(sig);
    expect(await computeRequestSignature({ ...base, nonce: 'n1' })).not.toBe(
      await computeRequestSignature({ ...base, nonce: 'n2' }),
    );
  });

  it('normalizes method case (POST === post)', async () => {
    expect(await computeRequestSignature({ ...base, method: 'post' })).toBe(
      await computeRequestSignature({ ...base, method: 'POST' }),
    );
  });
});

describe('verifyRequestSignature', () => {
  const now = 1700000000000;

  it('accepts a valid, in-window signature', async () => {
    const signature = await computeRequestSignature(base);
    const verdict = await verifyRequestSignature({ ...base, signature, now });
    expect(verdict.valid).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const signature = await computeRequestSignature(base);
    const verdict = await verifyRequestSignature({
      ...base,
      body: '{"table_id":"evil"}',
      signature,
      now,
    });
    expect(verdict).toEqual({ valid: false, reason: 'mismatch' });
  });

  it('rejects a signature replayed against a different path', async () => {
    const signature = await computeRequestSignature(base);
    const verdict = await verifyRequestSignature({
      ...base,
      path: '/api/v1/customer/feedback',
      signature,
      now,
    });
    expect(verdict).toEqual({ valid: false, reason: 'mismatch' });
  });

  it('accepts a nonce-signed request and rejects a swapped nonce', async () => {
    const signature = await computeRequestSignature({ ...base, nonce: 'n1' });
    expect((await verifyRequestSignature({ ...base, nonce: 'n1', signature, now })).valid).toBe(
      true,
    );
    // Same captured signature but a different nonce → mismatch.
    expect(await verifyRequestSignature({ ...base, nonce: 'n2', signature, now })).toEqual({
      valid: false,
      reason: 'mismatch',
    });
  });

  it('rejects an expired timestamp (outside the window)', async () => {
    const signature = await computeRequestSignature(base);
    const verdict = await verifyRequestSignature({
      ...base,
      signature,
      now: now + DEFAULT_SIGNATURE_TOLERANCE_MS + 1,
    });
    expect(verdict).toEqual({ valid: false, reason: 'expired' });
  });

  it('accepts a timestamp at the edge of the window', async () => {
    const signature = await computeRequestSignature(base);
    const verdict = await verifyRequestSignature({
      ...base,
      signature,
      now: now + DEFAULT_SIGNATURE_TOLERANCE_MS,
    });
    expect(verdict.valid).toBe(true);
  });

  it('reports missing signature/timestamp', async () => {
    expect(await verifyRequestSignature({ ...base, signature: '', now })).toEqual({
      valid: false,
      reason: 'missing',
    });
  });

  it('reports a non-numeric timestamp', async () => {
    const signature = await computeRequestSignature(base);
    expect(
      await verifyRequestSignature({ ...base, timestamp: 'not-a-number', signature, now }),
    ).toEqual({ valid: false, reason: 'bad_timestamp' });
  });
});

describe('timingSafeEqualHex', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeEqualHex('deadbeef', 'deadbeef')).toBe(true);
  });
  it('returns false for different strings of equal length', () => {
    expect(timingSafeEqualHex('deadbeef', 'deadbee0')).toBe(false);
  });
  it('returns false for different lengths', () => {
    expect(timingSafeEqualHex('dead', 'deadbeef')).toBe(false);
  });
});
