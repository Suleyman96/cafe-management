-- H3 (signup anti-abuse): defer self-serve tenant provisioning until the
-- signer's email is CONFIRMED.
--
-- The problem this closes
-- -----------------------
-- Migration 20260728000001 wired `handle_new_tenant_signup()` as an
-- `AFTER INSERT ON auth.users` trigger. In GoTrue that INSERT happens at
-- `auth.signUp` time — BEFORE the confirmation email is clicked. So:
--
--   (a) DB spam: an unauthenticated script calling the public anon
--       `auth.signUp` endpoint creates a full tenant + ~13 seed rows
--       (tenant, owner staff, cafe_settings, 5 task categories,
--       6 expense categories) on every call — mass-tenant-spam.
--   (b) Email squatting: with email confirmation disabled, a tenant is
--       provisioned for an email the signer does not control.
--
-- The fix
-- -------
-- Re-point provisioning to run only once `email_confirmed_at` is set, while
-- still working when confirmation is disabled or the account is created
-- pre-confirmed (operator/admin API with `email_confirm: true`, which sets
-- `email_confirmed_at` at INSERT time).
--
--   * Trigger timing becomes `AFTER INSERT OR UPDATE OF email_confirmed_at`.
--   * The function provisions only when ALL hold:
--       1. NEW.email_confirmed_at IS NOT NULL   (email is confirmed)
--       2. the signup guard is present          (self-serve / operator signup)
--       3. no staff row exists yet for this user (idempotency)
--
-- Idempotency matrix (all handled by the guards above):
--   * INSERT already-confirmed  → confirmed + no staff yet → provisions once.
--   * INSERT unconfirmed         → email_confirmed_at NULL → no-op.
--   * later confirmation UPDATE  → now confirmed + no staff → provisions once.
--   * repeated UPDATEs           → staff row now exists     → no-op.
--
-- Everything else is IDENTICAL to 20260728000001: SECURITY DEFINER,
-- `search_path = ''`, plan forced to 'free' (never read from user metadata —
-- the anti-escalation guarantee), random slug, owner role, and all seed
-- INSERTs unchanged. No table or seed shapes change, so the generated types
-- (packages/database/src/types/generated.ts) are unaffected.
--
-- Operator note: for this to actually gate signups you MUST turn ON "Confirm
-- email" in Supabase Auth (and enable CAPTCHA). See docs/signup-hardening.md.

-- ── Re-point the provisioning function: provision only once confirmed ─────
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
  INSERT INTO public.tenants (name, slug, plan)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'My Restaurant'),
    v_slug,
    'free'
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

-- ── Re-wire the trigger to fire on confirmation, not on raw INSERT ────────
-- INSERT still covered (pre-confirmed / confirmation-disabled accounts);
-- `UPDATE OF email_confirmed_at` covers the normal "clicked the link" path.
DROP TRIGGER IF EXISTS on_auth_user_created_provision_tenant ON auth.users;
CREATE TRIGGER on_auth_user_created_provision_tenant
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_tenant_signup();
