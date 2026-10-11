-- L14 (compliance): PERSIST the signup Terms/Privacy consent server-side.
--
-- The problem this closes
-- -----------------------
-- The marketing signup form (apps/marketing/signup) gates the submit button on
-- an "I agree to the Terms and Privacy Policy" checkbox, but nothing recorded
-- that the user accepted, WHICH version of the Terms, or WHEN. There was no
-- auditable record of consent — a compliance gap.
--
-- The fix
-- -------
-- 1. Two nullable columns on public.tenants capture the consent snapshot:
--      * terms_version     — the Terms revision the user accepted (opaque
--                            string, bumped whenever the Terms text changes).
--      * terms_accepted_at  — when they accepted (client-supplied ISO timestamp).
-- 2. The signup form now forwards `terms_version` + `terms_accepted_at` in the
--    `auth.signUp` user metadata (apps/marketing/src/app/signup/page.tsx), and
--    the provisioning trigger persists them onto the tenant it creates.
--
-- Both columns are nullable → additive, non-destructive (no rollback file).
--
-- This re-defines handle_new_tenant_signup() from the LIVE H3 body
-- (20261011000003_provision_on_email_confirmed.sql) VERBATIM — same deferral,
-- idempotency, SECURITY DEFINER, search_path, and the plan='free'
-- anti-escalation guarantee — and changes ONLY the `INSERT INTO public.tenants`
-- so it also writes the two consent columns from the signup metadata. The H3
-- trigger wiring (AFTER INSERT OR UPDATE OF email_confirmed_at) is unchanged and
-- is intentionally NOT recreated: CREATE OR REPLACE of the function keeps the
-- existing trigger bound to the new body.
--
-- Operator / platform-created path: admin-created tenants (signup:'platform',
-- or any path that does not pass consent metadata) record NULL for both
-- columns. We deliberately do NOT COALESCE terms_accepted_at to now() — those
-- tenants did not click the consent checkbox, so a fabricated timestamp would
-- be a misleading audit record. NULL truthfully means "no consent captured via
-- this path".

-- ── 1. Consent columns on the tenant (additive, nullable) ────────────────────
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS terms_version text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- ── 2. Persist consent in the provisioning function (H3 body verbatim) ───────
CREATE OR REPLACE FUNCTION public.handle_new_tenant_signup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_tenant_id uuid;
  v_slug text;
BEGIN
  -- H3: provision only after the email is confirmed. On an unconfirmed INSERT
  -- (the `auth.signUp` path before the link is clicked) this returns early and
  -- creates nothing; the later confirmation UPDATE re-enters and provisions.
  -- When confirmation is disabled or the user is created pre-confirmed,
  -- email_confirmed_at is already set at INSERT and we provision immediately.
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only self-service / operator signups. Admin-created users (no `signup`
  -- flag) provision their tenant/staff manually and must not be provisioned
  -- here.
  IF NEW.raw_user_meta_data->>'signup' IS NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotency: never provision twice for the same user. This is the single
  -- guard that makes "INSERT confirmed" and "confirmation UPDATE" each
  -- provision exactly once and every later fire a no-op — a staff owner row is
  -- created below for every provisioned tenant, so its presence is the signal
  -- that provisioning already ran.
  IF EXISTS (SELECT 1 FROM public.staff WHERE auth_user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_slug := lower(regexp_replace(
    COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'restaurant'),
    '[^a-zA-Z0-9]+', '-', 'g'
  )) || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- SECURITY: always 'free'. NEVER read plan from raw_user_meta_data — that was
  -- a self-grant vector. Upgrades happen only via the Stripe webhook.
  -- L14: also persist the Terms/Privacy consent snapshot. terms_version and
  -- terms_accepted_at come straight from the signup metadata; both are NULL
  -- when absent (operator/platform path), which truthfully means "no consent
  -- captured via this path". The timestamp is client-supplied (ISO 8601) and
  -- cast to timestamptz.
  INSERT INTO public.tenants (name, slug, plan, terms_version, terms_accepted_at)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'My Restaurant'),
    v_slug,
    'free',
    NEW.raw_user_meta_data->>'terms_version',
    (NEW.raw_user_meta_data->>'terms_accepted_at')::timestamptz
  )
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.staff (auth_user_id, email, full_name, role, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Owner'),
    'owner',
    v_tenant_id
  );

  INSERT INTO public.cafe_settings (tenant_id, restaurant_name)
  VALUES (v_tenant_id, COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'My Restaurant'));

  -- Default categories so the Tasks/Expenses pickers aren't empty on first run.
  INSERT INTO public.task_categories (tenant_id, name, icon, color) VALUES
    (v_tenant_id, 'Opening', '🌅', '#22c55e'),
    (v_tenant_id, 'Closing', '🌙', '#6366f1'),
    (v_tenant_id, 'Cleaning', '🧹', '#06b6d4'),
    (v_tenant_id, 'Inventory', '📦', '#f59e0b'),
    (v_tenant_id, 'General', '📋', '#64748b');

  INSERT INTO public.expense_categories (tenant_id, name, icon) VALUES
    (v_tenant_id, 'Food & Ingredients', '🍕'),
    (v_tenant_id, 'Beverages', '☕'),
    (v_tenant_id, 'Utilities', '💡'),
    (v_tenant_id, 'Rent', '🏠'),
    (v_tenant_id, 'Equipment', '🔧'),
    (v_tenant_id, 'Other', '📌');

  RETURN NEW;
END;
$$;

-- Trigger wiring is intentionally untouched: H3 already bound
-- on_auth_user_created_provision_tenant to AFTER INSERT OR UPDATE OF
-- email_confirmed_at, and CREATE OR REPLACE above swaps in the new body under
-- the same trigger. No DROP/CREATE TRIGGER needed.
