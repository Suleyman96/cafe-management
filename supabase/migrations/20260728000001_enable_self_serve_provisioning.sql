-- Enable safe self-serve tenant provisioning + subscription-schema groundwork.
--
-- Two problems this closes:
--
-- 1. Signups create orphaned users. `handle_new_tenant_signup()` was defined in
--    the baseline but NEVER attached to auth.users, so a self-serve signup
--    (marketing /signup → auth.signUp) created an auth user with no tenant/staff
--    row. That user logs in and is bounced by middleware (no active staff).
--
-- 2. Privilege escalation via signup metadata. The function read the plan from
--    `NEW.raw_user_meta_data->>'plan'` — and the signup form forwards `?plan=` from
--    the URL — so a user could self-grant `business` for free by signing up with
--    `?plan=business`. Self-serve tenants must ALWAYS be provisioned `free`; plan
--    changes flow ONLY from the (future) Stripe webhook, never from user input.
--
-- Fixes: force plan = 'free' in the function, then wire it as an AFTER INSERT
-- trigger on auth.users. Admin-created users (create-owner-user.sh, which
-- provisions manually and sets no `signup` metadata) are skipped by the guard.

-- ── Part 1. Subscription-schema groundwork on tenants ─────────────────────
-- Columns the Stripe billing layer will populate. NULL until billing is wired.
-- tenants already has RLS with only a SELECT policy for the owning tenant and
-- no client INSERT/UPDATE — so clients can read their own billing status but
-- only the service-role webhook can write these.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS billing_email text;

COMMENT ON COLUMN public.tenants.subscription_status IS
  'Stripe subscription status (active/trialing/past_due/canceled/…). NULL until billing is wired. `plan` is changed ONLY by the Stripe webhook, never from user input.';

-- ── Part 2. Harden the provisioning function: plan is always free ─────────
CREATE OR REPLACE FUNCTION public.handle_new_tenant_signup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_tenant_id uuid;
  v_slug text;
BEGIN
  -- Only self-service signups. Admin-created users (no `signup` flag) provision
  -- their tenant/staff manually and must not be double-provisioned here.
  IF NEW.raw_user_meta_data->>'signup' IS NULL THEN
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

-- ── Part 3. Wire the trigger onto auth.users ──────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created_provision_tenant ON auth.users;
CREATE TRIGGER on_auth_user_created_provision_tenant
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_tenant_signup();
