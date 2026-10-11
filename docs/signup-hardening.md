# Signup hardening (H3 anti-abuse) — operator runbook

The public self-serve signup funnel (`apps/marketing/signup` → `auth.signUp`)
was hardened against mass-tenant-spam and email-squatting. Two of the three
controls are **code** (already shipped); the rest are **operator config** that
must be turned on in the Supabase + Vercel dashboards for the controls to
actually take effect.

## What changed in code

1. **Provisioning deferred to email confirmation.**
   Migration `20261011000003_provision_on_email_confirmed.sql` re-points the
   `handle_new_tenant_signup()` trigger from `AFTER INSERT ON auth.users` to
   `AFTER INSERT OR UPDATE OF email_confirmed_at`. A tenant (+ owner staff,
   cafe settings, and the default task/expense categories) is now created
   **only once `email_confirmed_at` is set** — i.e. after the user clicks the
   confirmation link. A pre-confirmed account (operator admin API with
   `email_confirm: true`, or confirmation globally disabled) still provisions
   immediately. The function is idempotent: an unconfirmed insert provisions
   nothing, the later confirmation provisions exactly once, and repeated
   confirmation updates are no-ops.

   The anti-escalation guarantee is unchanged: `plan` is always forced to
   `free` and never read from user metadata.

2. **CAPTCHA (Cloudflare Turnstile) on the signup form.**
   The form renders a Turnstile widget and passes its token to
   `supabase.auth.signUp({ options: { captchaToken } })`. Supabase verifies the
   token server-side against the secret you configure in the Auth dashboard.
   The widget is shown (and a token required) **only when the public site key
   is configured**; with no key set, the form degrades gracefully and signup
   still works (local dev).

## Operator steps to activate (production)

Do all four — the code is inert without them.

### 1. Turn ON email confirmation (closes spam + squatting)
Supabase Dashboard → **Authentication → Providers → Email** → enable
**"Confirm email"**. Until this is on, GoTrue auto-confirms at `signUp` and the
deferral has no gate to wait for.

### 2. Create Cloudflare Turnstile keys
Cloudflare Dashboard → **Turnstile** → add a widget for the marketing domain.
You get a **Site key** (public) and a **Secret key** (private).

### 3. Enable CAPTCHA in Supabase Auth
Supabase Dashboard → **Authentication → Attack Protection** → enable
**CAPTCHA protection**, provider **Turnstile**, and paste the **Secret key**.
This makes Supabase reject any `signUp` whose `captchaToken` is missing or
invalid — the server-side half of the control.

### 4. Set the public site key in Vercel (marketing project)
Add env var `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the Turnstile **Site key** to
the `@gustri/marketing` Vercel project (Production + Preview), then redeploy.
This is what makes the widget render and the submit button require a token.

## Notes

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is intentionally public — it only identifies
  the widget. The secret stays in Supabase, never in client code.
- Local dev: leave `NEXT_PUBLIC_TURNSTILE_SITE_KEY` unset; the widget is
  skipped and signup is not blocked. (Cloudflare also publishes always-pass
  test keys if you want to exercise the widget locally.)
- The marketing CSP (`apps/marketing/src/middleware.ts`) already allows
  `https://challenges.cloudflare.com` for the Turnstile script, frame, and
  verification endpoint.
- Because provisioning now waits for confirmation, a user who never clicks the
  link has an auth account but **no tenant/staff** — exactly as intended. They
  can re-request confirmation; no orphaned tenant is created in the meantime.

## L14 — Terms/Privacy consent is persisted (compliance)

The signup consent checkbox used to only gate the submit button; nothing
recorded that the user accepted, which Terms version, or when. That consent is
now an auditable record on the tenant.

- **Schema** (`20261012000001_persist_signup_consent.sql`): two nullable columns
  on `public.tenants` — `terms_version text` and `terms_accepted_at timestamptz`.
  The migration re-defines `handle_new_tenant_signup()` from the H3 body
  verbatim (all deferral / idempotency / `plan='free'` anti-escalation
  behaviour unchanged) and only adds these two columns to the
  `INSERT INTO public.tenants`, reading them from the signup metadata
  (`raw_user_meta_data->>'terms_version'` and
  `(raw_user_meta_data->>'terms_accepted_at')::timestamptz`). The H3 trigger
  wiring is untouched (`CREATE OR REPLACE` re-points the existing trigger).
- **Client** (`apps/marketing/src/app/signup/page.tsx`): once `agreed` is
  checked, `auth.signUp` forwards `terms_version: TERMS_VERSION` and
  `terms_accepted_at: new Date().toISOString()` in `options.data`.
- **`TERMS_VERSION`** lives in `apps/marketing/src/lib/constants.ts` (currently
  `'2026-10-11'`). **Bump it whenever the Terms or Privacy text changes
  materially** — the new value becomes the version recorded for every signup
  thereafter, which is how we tell who accepted which revision. It's an opaque
  date-stamped string; compare for equality, never parse.
- **Operator / platform-created path** (`admin.createUser` with
  `signup: 'platform'`, or any path that passes no consent metadata) records
  `NULL` for both columns. We deliberately do **not** COALESCE
  `terms_accepted_at` to `now()`: those tenants never clicked the consent
  checkbox, so a fabricated timestamp would be a misleading audit record. NULL
  truthfully means "no consent captured via this path".
