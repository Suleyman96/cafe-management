import { describe, expect, it } from 'vitest';
import { hashPin, verifyPin } from '@/lib/api/pin-hash';

// Plan 13 — the soft-lock PIN's KDF. The hash itself contains a random
// salt, so two hashes of the same PIN must differ; verification must
// accept the right PIN, reject the wrong one, and reject malformed
// stored values without throwing (a malformed value is functionally
// equivalent to "no PIN set" — fail closed).

describe('pin-hash', () => {
  it('produces a self-describing scrypt-v1 hash', () => {
    const hash = hashPin('1234');
    expect(hash.startsWith('scrypt-v1:')).toBe(true);
    expect(hash.split(':')).toHaveLength(3);
  });

  it('uses a fresh salt each time (no determinism)', () => {
    const a = hashPin('1234');
    const b = hashPin('1234');
    expect(a).not.toBe(b);
  });

  it('verifies the correct PIN', () => {
    const hash = hashPin('246810');
    expect(verifyPin('246810', hash)).toBe(true);
  });

  it('rejects the wrong PIN', () => {
    const hash = hashPin('246810');
    expect(verifyPin('000000', hash)).toBe(false);
    expect(verifyPin('24681', hash)).toBe(false);
    expect(verifyPin('2468100', hash)).toBe(false);
  });

  it('rejects malformed stored values without throwing', () => {
    expect(verifyPin('1234', null)).toBe(false);
    expect(verifyPin('1234', undefined)).toBe(false);
    expect(verifyPin('1234', '')).toBe(false);
    expect(verifyPin('1234', 'totally-invalid')).toBe(false);
    expect(verifyPin('1234', 'wrong-version:salt:hash')).toBe(false);
    expect(verifyPin('1234', 'scrypt-v1:bad!base64:bad!base64')).toBe(false);
  });

  it('verifies independently across multiple hashes', () => {
    const a = hashPin('1111');
    const b = hashPin('2222');
    expect(verifyPin('1111', a)).toBe(true);
    expect(verifyPin('2222', b)).toBe(true);
    expect(verifyPin('1111', b)).toBe(false);
    expect(verifyPin('2222', a)).toBe(false);
  });
});
