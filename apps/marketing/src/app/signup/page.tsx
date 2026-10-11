'use client';

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import * as Sentry from '@sentry/nextjs';
import { ArrowLeft, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState } from 'react';
import { STAFF_APP_URL, TERMS_VERSION } from '@/lib/constants';
import { isSignupSubmitReady } from '@/lib/signup-gate';
import { getSupabase } from '@/lib/supabase';

// H3 (anti-abuse): Cloudflare Turnstile site key. PUBLIC by design (it only
// identifies the widget; the secret lives in the Supabase dashboard, which
// verifies the token server-side on signUp). When unset — local dev — we skip
// the widget and don't block signup (graceful degrade); when set, a token is
// required before the submit button enables.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const VALID_PLANS = ['free', 'standard', 'pro', 'business'] as const;
type Plan = (typeof VALID_PLANS)[number];

function normalizePlan(value: string | null): Plan {
  return VALID_PLANS.includes(value as Plan) ? (value as Plan) : 'free';
}

const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  standard: 'Standard',
  pro: 'Pro',
  business: 'Business',
};

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const plan = normalizePlan(searchParams.get('plan'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);

  // CAPTCHA only applies when a site key is configured (see TURNSTILE_SITE_KEY).
  const captchaRequired = Boolean(TURNSTILE_SITE_KEY);
  const canSubmit = isSignupSubmitReady({ agreed, captchaRequired, captchaToken, isLoading });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (!agreed) {
      setError('Please agree to the Terms and Privacy Policy to continue.');
      return;
    }

    if (captchaRequired && !captchaToken) {
      setError('Please complete the verification challenge to continue.');
      return;
    }

    setIsLoading(true);

    try {
      const { error: signUpError } = await getSupabase().auth.signUp({
        email,
        password,
        options: {
          // `signup` is the provisioning guard — the server provisions every
          // self-serve tenant on the free plan and IGNORES any client-supplied
          // plan (migration 20260728000001). We don't forward `plan` so there's
          // no illusion the client controls it; upgrades happen via billing
          // later.
          //
          // L14 (compliance): record the Terms/Privacy consent the user just
          // gave via the `agreed` checkbox (gated above). The provisioning
          // trigger (migration 20261012000001) persists terms_version +
          // terms_accepted_at onto the tenant, so consent is auditable: which
          // Terms revision, accepted when. The timestamp is captured client-
          // side at submit; TERMS_VERSION is bumped whenever the Terms change.
          data: {
            signup: 'true',
            terms_version: TERMS_VERSION,
            terms_accepted_at: new Date().toISOString(),
          },
          emailRedirectTo: `${STAFF_APP_URL}/auth/callback?next=/`,
          // H3: pass the Turnstile token when we have one. Supabase verifies it
          // server-side against the secret configured in the Auth dashboard and
          // rejects the signup if it's missing/invalid. Undefined (not '') when
          // CAPTCHA isn't configured, so local dev signUp is unaffected.
          captchaToken: captchaRequired ? captchaToken : undefined,
        },
      });

      if (signUpError) {
        // Turnstile tokens are single-use — reset the widget so the user can
        // get a fresh token before retrying (otherwise re-submit fails on a
        // spent token).
        if (captchaRequired) {
          turnstileRef.current?.reset();
          setCaptchaToken('');
        }
        // M7 — never surface GoTrue's raw message (e.g. "User already
        // registered"): it lets an attacker enumerate which emails have
        // accounts. Report the raw error to Sentry / the dev console for ops,
        // and show the user a generic message that reveals nothing about
        // whether the email exists.
        //
        // i18n note: this marketing site is English-only at runtime (no
        // language switcher, `<html lang="en">`) and every other string in
        // this form — including the sibling validation errors above — is
        // inline English. We keep the copy inline for consistency; the
        // translatable source of truth lives in `auth.json` under
        // `signupFailed` across all 20 locales, ready for when marketing is
        // internationalized.
        console.error('[signup] sign-up failed', signUpError);
        Sentry.captureException(signUpError, { tags: { surface: 'marketing-signup' } });
        setError('Something went wrong. Please check your details and try again.');
        return;
      }

      setIsSuccess(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 to-white" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary-100/30 rounded-full blur-3xl" />
        </div>

        <div className="mx-auto max-w-md px-4 sm:px-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Check your email</h1>
          <p className="mt-4 text-gray-600 leading-relaxed">
            We sent a confirmation link to <strong className="text-gray-900">{email}</strong>. Click
            the link to activate your account and start setting up your cafe.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 to-white" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary-100/30 rounded-full blur-3xl" />
      </div>

      <div className="mx-auto max-w-md px-4 sm:px-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Create your account
          </h1>
          <p className="mt-2 text-gray-600">
            Just email and password. We'll set up your cafe inside.
          </p>
        </div>

        {plan !== 'free' && (
          <div className="mb-6 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800">
            You picked the <strong>{PLAN_LABELS[plan]}</strong> plan. You'll start free — we'll
            prompt you to confirm billing only when you're ready to use paid features.
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm space-y-5"
        >
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@cafe.com"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <label className="flex items-start gap-2.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <span>
              I agree to the{' '}
              <a href="/terms" className="font-medium text-primary-600 hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" className="font-medium text-primary-600 hover:underline">
                Privacy Policy
              </a>
              .
            </span>
          </label>

          {/* H3: Cloudflare Turnstile. Rendered only when a site key is
              configured; local dev (no key) skips it and signup still works. */}
          {TURNSTILE_SITE_KEY && (
            <Turnstile
              ref={turnstileRef}
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={setCaptchaToken}
              onExpire={() => setCaptchaToken('')}
              onError={() => setCaptchaToken('')}
              options={{ theme: 'light', size: 'flexible' }}
            />
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-primary-500/25 hover:bg-primary-600 transition-all hover:shadow-primary-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-500">
            No credit card. Free forever for up to 300 orders/mo.
          </p>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <a
              href={`${STAFF_APP_URL}/login`}
              className="font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              Sign in
            </a>
          </p>
        </form>

        {/* What happens next */}
        <div className="mt-8 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-5">
          <p className="text-sm font-semibold text-gray-900">What happens after you sign up</p>
          <ol className="mt-3 space-y-2 text-sm text-gray-600">
            <li className="flex gap-2">
              <span className="font-semibold text-primary-600">1.</span> Confirm your email (30
              seconds)
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-primary-600">2.</span> Name your cafe and pick a
              language for your staff
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-primary-600">3.</span> Add your first menu items
              and print a QR code
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-primary-600">4.</span> Take your first order —
              you're live
            </li>
          </ol>
          <p className="mt-4 text-xs text-gray-500">
            Total: 5–15 minutes. No download. No installation. Works on the tablet you already own.
          </p>
        </div>
      </div>
    </section>
  );
}
