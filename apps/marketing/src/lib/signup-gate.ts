/**
 * Pure gating logic for the self-serve signup form (H3 anti-abuse).
 *
 * Kept as a headless helper (no React, no DOM) so the CAPTCHA/consent gate can
 * be unit-tested deterministically without rendering the whole page + mocking
 * Next's router, Sentry and Supabase.
 *
 * CAPTCHA behaviour is a graceful degrade: the Cloudflare Turnstile widget is
 * only shown — and a token only required — when a PUBLIC site key is
 * configured (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`). Local dev with no key set
 * skips the widget entirely so signup still works.
 */

export interface SignupGateState {
  /** User ticked the Terms + Privacy consent box. */
  agreed: boolean;
  /** True when a Turnstile site key is configured, so a token is required. */
  captchaRequired: boolean;
  /** The Turnstile token, if the widget has produced one. */
  captchaToken: string;
  /** A sign-up request is already in flight. */
  isLoading: boolean;
}

/**
 * Whether the signup submit button should be enabled.
 *
 * Requires the consent gate, and — only when CAPTCHA is configured — a
 * non-empty Turnstile token. Disabled while a request is in flight.
 */
export function isSignupSubmitReady(state: SignupGateState): boolean {
  if (state.isLoading) return false;
  if (!state.agreed) return false;
  if (state.captchaRequired && state.captchaToken.trim() === '') return false;
  return true;
}
