-- ============================================================================
-- Migration: Plan-Based Limit Enforcement
-- Date: 2026-04-06
-- Description: Add SQL triggers to enforce table and order limits per plan,
--   RPCs for UI queries, and fix signup trigger to save selected plan.
-- ============================================================================

-- ============================================================
-- 1. Fix signup trigger to save the plan from auth metadata
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_tenant_signup()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
  v_slug TEXT;
  v_plan TEXT;
BEGIN
  -- Only process self-service signups (not admin-created users)
  IF NEW.raw_user_meta_data->>'signup' IS NULL THEN
    RETURN NEW;
  END IF;

  -- Read plan from signup metadata (default to free)
  v_plan := COALESCE(NEW.raw_user_meta_data->>'plan', 'free');
  IF v_plan NOT IN ('free', 'standard', 'pro', 'business') THEN
    v_plan := 'free';
  END IF;

  -- Generate URL-friendly slug from restaurant name
  v_slug := lower(regexp_replace(
    COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'restaurant'),
    '[^a-zA-Z0-9]+', '-', 'g'
  ));
  v_slug := v_slug || '-' || substr(gen_random_uuid()::TEXT, 1, 8);

  -- Create tenant with selected plan
  INSERT INTO public.tenants (name, slug, plan)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'My Restaurant'),
    v_slug,
    v_plan
  )
  RETURNING id INTO v_tenant_id;

  -- Create owner staff record
  INSERT INTO public.staff (auth_user_id, email, full_name, role, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Owner'),
    'owner',
    v_tenant_id
  );

  -- Create default cafe settings
  INSERT INTO public.cafe_settings (tenant_id, restaurant_name)
  VALUES (v_tenant_id, COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'My Restaurant'));

  -- Create default task categories
  INSERT INTO public.task_categories (tenant_id, name, icon, color) VALUES
    (v_tenant_id, 'Opening', '🌅', '#22c55e'),
    (v_tenant_id, 'Closing', '🌙', '#6366f1'),
    (v_tenant_id, 'Cleaning', '🧹', '#06b6d4'),
    (v_tenant_id, 'Inventory', '📦', '#f59e0b'),
    (v_tenant_id, 'General', '📋', '#64748b');

  -- Create default expense categories
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

-- ============================================================
-- 2. Table limit enforcement trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_table_limit()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan TEXT;
  v_count INT;
  v_max INT;
BEGIN
  SELECT t.plan INTO v_plan FROM public.tenants t WHERE t.id = NEW.tenant_id;

  v_max := CASE v_plan
    WHEN 'free' THEN 5
    WHEN 'standard' THEN 10
    WHEN 'pro' THEN 20
    ELSE -1
  END;

  IF v_max = -1 THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_count FROM public.tables WHERE tenant_id = NEW.tenant_id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Table limit reached for % plan (max %)', v_plan, v_max;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_table_limit
  BEFORE INSERT ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.check_table_limit();

-- ============================================================
-- 3. Monthly order limit enforcement trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_order_limit()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan TEXT;
  v_count INT;
  v_max INT;
BEGIN
  SELECT t.plan INTO v_plan FROM public.tenants t WHERE t.id = NEW.tenant_id;

  v_max := CASE v_plan
    WHEN 'free' THEN 100
    WHEN 'standard' THEN 700
    WHEN 'pro' THEN 2200
    ELSE -1
  END;

  IF v_max = -1 THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_count FROM public.orders
  WHERE tenant_id = NEW.tenant_id
    AND created_at >= date_trunc('month', NOW());

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Monthly order limit reached for % plan (max %)', v_plan, v_max;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_order_limit
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.check_order_limit();

-- ============================================================
-- 4. RPC: Get monthly order count for current tenant
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_monthly_order_count()
RETURNS INT
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COUNT(*)::INT FROM public.orders
  WHERE tenant_id = public.current_tenant_id()
    AND created_at >= date_trunc('month', NOW());
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_order_count() TO authenticated;

-- ============================================================
-- 5. RPC: Get tenant plan from QR table context (for anon)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_tenant_plan_from_context()
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT t.plan FROM public.tenants t
  WHERE t.id = current_setting('app.current_tenant_id', true)::UUID;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_plan_from_context() TO anon;
