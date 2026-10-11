import { describe, expect, test } from 'vitest';
import { isSignupSubmitReady } from '../signup-gate';

describe('isSignupSubmitReady (H3 signup anti-abuse gate)', () => {
  describe('CAPTCHA configured (site key set)', () => {
    const base = { agreed: true, captchaRequired: true, captchaToken: '', isLoading: false };

    test('blocks submit until a Turnstile token is present', () => {
      expect(isSignupSubmitReady(base)).toBe(false);
      expect(isSignupSubmitReady({ ...base, captchaToken: '   ' })).toBe(false);
    });

    test('allows submit once a token is present and terms are agreed', () => {
      expect(isSignupSubmitReady({ ...base, captchaToken: 'tok_abc' })).toBe(true);
    });

    test('still requires the terms consent even with a token', () => {
      expect(isSignupSubmitReady({ ...base, captchaToken: 'tok_abc', agreed: false })).toBe(false);
    });

    test('blocks while a request is in flight', () => {
      expect(isSignupSubmitReady({ ...base, captchaToken: 'tok_abc', isLoading: true })).toBe(
        false,
      );
    });
  });

  describe('CAPTCHA not configured (graceful degrade — local dev)', () => {
    const base = { agreed: true, captchaRequired: false, captchaToken: '', isLoading: false };

    test('allows submit without any token when agreed', () => {
      expect(isSignupSubmitReady(base)).toBe(true);
    });

    test('still requires the terms consent', () => {
      expect(isSignupSubmitReady({ ...base, agreed: false })).toBe(false);
    });

    test('blocks while a request is in flight', () => {
      expect(isSignupSubmitReady({ ...base, isLoading: true })).toBe(false);
    });
  });
});
