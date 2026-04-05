-- ============================================================================
-- Migration: Multi-Tenancy Support
-- Date: 2026-04-06
-- Description: Add tenant isolation to all tables for SaaS multi-tenancy.
--   Creates tenants table, adds tenant_id to all data tables, enables RLS
--   with tenant-scoped policies, and adds self-service signup trigger.
-- ============================================================================

-- ============================================================
-- 1. Create tenants table
-- ============================================================

CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(20) NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'standard', 'pro', 'business')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON public.tenants(slug);
CREATE INDEX idx_tenants_active ON public.tenants(is_active);

-- Updated_at trigger for tenants
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. Create a default tenant for existing data
-- ============================================================

INSERT INTO public.tenants (id, name, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Restaurant', 'default', 'pro');

-- ============================================================
-- 3. Add tenant_id to all data tables
-- ============================================================

-- Core tables
ALTER TABLE public.staff ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.tables ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.categories ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.menu_items ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.orders ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.order_items ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.waiter_calls ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.customer_feedback ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.order_payments ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.table_transfers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.cafe_settings ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);

-- Staff & operations tables
ALTER TABLE public.staff_schedules ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.stock_items ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.stock_movements ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.expense_categories ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.expenses ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.waste_logs ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.task_categories ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.tasks ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.refunds ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.delivery_customers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);

-- Staff notes (if exists)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_notes') THEN
    ALTER TABLE public.staff_notes ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;
END $$;

-- ============================================================
-- 4. Backfill existing data with default tenant
-- ============================================================

UPDATE public.staff SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.tables SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.categories SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.menu_items SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.orders SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.order_items SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.waiter_calls SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.customer_feedback SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.order_payments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.table_transfers SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.cafe_settings SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.staff_schedules SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.stock_items SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.stock_movements SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.expense_categories SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.expenses SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.waste_logs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.task_categories SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.tasks SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.refunds SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.delivery_customers SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_notes') THEN
    EXECUTE 'UPDATE public.staff_notes SET tenant_id = ''00000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL';
  END IF;
END $$;

-- ============================================================
-- 5. Set NOT NULL constraint after backfill
-- ============================================================

ALTER TABLE public.staff ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.tables ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.categories ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.menu_items ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.order_items ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.waiter_calls ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.customer_feedback ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.order_payments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.table_transfers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.cafe_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.staff_schedules ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.stock_items ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.stock_movements ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.expense_categories ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.expenses ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.waste_logs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.task_categories ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.refunds ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.delivery_customers ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================================
-- 6. Create indexes for tenant_id on all tables
-- ============================================================

CREATE INDEX idx_staff_tenant ON public.staff(tenant_id);
CREATE INDEX idx_tables_tenant ON public.tables(tenant_id);
CREATE INDEX idx_categories_tenant ON public.categories(tenant_id);
CREATE INDEX idx_menu_items_tenant ON public.menu_items(tenant_id);
CREATE INDEX idx_orders_tenant ON public.orders(tenant_id);
CREATE INDEX idx_order_items_tenant ON public.order_items(tenant_id);
CREATE INDEX idx_waiter_calls_tenant ON public.waiter_calls(tenant_id);
CREATE INDEX idx_customer_feedback_tenant ON public.customer_feedback(tenant_id);
CREATE INDEX idx_order_payments_tenant ON public.order_payments(tenant_id);
CREATE INDEX idx_table_transfers_tenant ON public.table_transfers(tenant_id);
CREATE INDEX idx_cafe_settings_tenant ON public.cafe_settings(tenant_id);
CREATE INDEX idx_staff_schedules_tenant ON public.staff_schedules(tenant_id);
CREATE INDEX idx_stock_items_tenant ON public.stock_items(tenant_id);
CREATE INDEX idx_stock_movements_tenant ON public.stock_movements(tenant_id);
CREATE INDEX idx_expense_categories_tenant ON public.expense_categories(tenant_id);
CREATE INDEX idx_expenses_tenant ON public.expenses(tenant_id);
CREATE INDEX idx_waste_logs_tenant ON public.waste_logs(tenant_id);
CREATE INDEX idx_task_categories_tenant ON public.task_categories(tenant_id);
CREATE INDEX idx_tasks_tenant ON public.tasks(tenant_id);
CREATE INDEX idx_refunds_tenant ON public.refunds(tenant_id);
CREATE INDEX idx_delivery_customers_tenant ON public.delivery_customers(tenant_id);

-- ============================================================
-- 7. Helper function: get current user's tenant_id
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT tenant_id FROM public.staff WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- 8. Set column defaults (auto-fill tenant_id on insert)
-- ============================================================

ALTER TABLE public.staff ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.tables ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.categories ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.menu_items ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.orders ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.order_items ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.waiter_calls ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.customer_feedback ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.order_payments ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.table_transfers ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.cafe_settings ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.staff_schedules ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.stock_items ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.stock_movements ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.expense_categories ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.expenses ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.waste_logs ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.task_categories ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.tasks ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.refunds ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.delivery_customers ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();

-- ============================================================
-- 9. Enable RLS on all tables
-- ============================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_customers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 10. RLS Policies — Tenants table
-- ============================================================

CREATE POLICY "tenant_read_own" ON public.tenants
  FOR SELECT TO authenticated
  USING (id = public.current_tenant_id());

-- ============================================================
-- 11. RLS Policies — Authenticated-only tables
--     Staff can read/write only their own tenant's data
-- ============================================================

-- Staff
CREATE POLICY "tenant_isolation" ON public.staff
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Staff schedules
CREATE POLICY "tenant_isolation" ON public.staff_schedules
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Stock items
CREATE POLICY "tenant_isolation" ON public.stock_items
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Stock movements
CREATE POLICY "tenant_isolation" ON public.stock_movements
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Expense categories
CREATE POLICY "tenant_isolation" ON public.expense_categories
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Expenses
CREATE POLICY "tenant_isolation" ON public.expenses
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Waste logs
CREATE POLICY "tenant_isolation" ON public.waste_logs
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Task categories
CREATE POLICY "tenant_isolation" ON public.task_categories
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Tasks
CREATE POLICY "tenant_isolation" ON public.tasks
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Refunds
CREATE POLICY "tenant_isolation" ON public.refunds
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Delivery customers
CREATE POLICY "tenant_isolation" ON public.delivery_customers
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- ============================================================
-- 12. RLS Policies — Customer-accessible tables
--     Authenticated staff: full access to own tenant
--     Anon customers: read/write via table context (QR scan)
-- ============================================================

-- Tables
CREATE POLICY "tenant_isolation" ON public.tables
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "anon_read_via_context" ON public.tables
  FOR SELECT TO anon
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

-- Categories
CREATE POLICY "tenant_isolation" ON public.categories
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "anon_read_via_context" ON public.categories
  FOR SELECT TO anon
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

-- Menu items
CREATE POLICY "tenant_isolation" ON public.menu_items
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "anon_read_via_context" ON public.menu_items
  FOR SELECT TO anon
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

-- Cafe settings
CREATE POLICY "tenant_isolation" ON public.cafe_settings
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "anon_read_via_context" ON public.cafe_settings
  FOR SELECT TO anon
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

-- Orders
CREATE POLICY "tenant_isolation" ON public.orders
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "anon_read_via_context" ON public.orders
  FOR SELECT TO anon
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

CREATE POLICY "anon_insert_via_context" ON public.orders
  FOR INSERT TO anon
  WITH CHECK (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

CREATE POLICY "anon_update_cancel" ON public.orders
  FOR UPDATE TO anon
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true))
  WITH CHECK (status = 'cancelled');

-- Order items
CREATE POLICY "tenant_isolation" ON public.order_items
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "anon_read_via_context" ON public.order_items
  FOR SELECT TO anon
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

CREATE POLICY "anon_insert_via_context" ON public.order_items
  FOR INSERT TO anon
  WITH CHECK (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

-- Waiter calls
CREATE POLICY "tenant_isolation" ON public.waiter_calls
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "anon_read_via_context" ON public.waiter_calls
  FOR SELECT TO anon
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

CREATE POLICY "anon_insert_via_context" ON public.waiter_calls
  FOR INSERT TO anon
  WITH CHECK (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

-- Customer feedback
CREATE POLICY "tenant_isolation" ON public.customer_feedback
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "anon_read_via_context" ON public.customer_feedback
  FOR SELECT TO anon
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

CREATE POLICY "anon_insert_via_context" ON public.customer_feedback
  FOR INSERT TO anon
  WITH CHECK (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

-- Order payments
CREATE POLICY "tenant_isolation" ON public.order_payments
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "anon_read_via_context" ON public.order_payments
  FOR SELECT TO anon
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

-- Table transfers
CREATE POLICY "tenant_isolation" ON public.table_transfers
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Staff notes (if exists)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_notes') THEN
    EXECUTE 'ALTER TABLE public.staff_notes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "tenant_isolation" ON public.staff_notes FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())';
  END IF;
END $$;

-- ============================================================
-- 13. Update set_table_context to also set tenant context
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_table_context(qr_token TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_table_id UUID;
  v_tenant_id UUID;
BEGIN
  SELECT id, tenant_id INTO v_table_id, v_tenant_id
  FROM public.tables WHERE qr_code = qr_token;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'Invalid QR code';
  END IF;

  PERFORM set_config('app.qr_token', qr_token, true);
  PERFORM set_config('app.current_table_id', v_table_id::TEXT, true);
  PERFORM set_config('app.current_tenant_id', v_tenant_id::TEXT, true);
END;
$$;

-- ============================================================
-- 14. Update calculate_order_total to scope cafe_settings by tenant
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_order_total(order_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  calculated_subtotal DECIMAL(10, 2);
  calculated_tax DECIMAL(10, 2);
  calculated_total DECIMAL(10, 2);
  settings_tax_enabled BOOLEAN;
  settings_tax_percentage DECIMAL(5, 2);
  v_tenant_id UUID;
BEGIN
  -- Get tenant from the order
  SELECT tenant_id INTO v_tenant_id FROM public.orders WHERE id = order_uuid;

  -- Get tax settings for this tenant
  SELECT tax_enabled, tax_percentage
  INTO settings_tax_enabled, settings_tax_percentage
  FROM public.cafe_settings
  WHERE tenant_id = v_tenant_id
  LIMIT 1;

  -- Calculate subtotal
  SELECT COALESCE(SUM(item_price * quantity), 0)
  INTO calculated_subtotal
  FROM public.order_items
  WHERE order_id = order_uuid;

  -- Calculate tax
  IF settings_tax_enabled = true AND settings_tax_percentage > 0 THEN
    calculated_tax := calculated_subtotal * (settings_tax_percentage / 100);
  ELSE
    calculated_tax := 0;
  END IF;

  calculated_total := calculated_subtotal + calculated_tax;

  -- Update order
  UPDATE public.orders
  SET subtotal = calculated_subtotal, tax = calculated_tax, total = calculated_total, updated_at = NOW()
  WHERE id = order_uuid;
END;
$$;

-- ============================================================
-- 15. Update generate_order_number to scope per tenant
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS VARCHAR(15)
LANGUAGE plpgsql
AS $$
DECLARE
  new_number VARCHAR(15);
  counter INTEGER;
  v_tenant_id UUID;
BEGIN
  -- Try to get tenant from session context (anon) or current user (authenticated)
  v_tenant_id := COALESCE(
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID,
    public.current_tenant_id()
  );

  SELECT COUNT(*) INTO counter
  FROM public.orders
  WHERE DATE(created_at) = CURRENT_DATE
    AND (v_tenant_id IS NULL OR tenant_id = v_tenant_id);

  new_number := 'ORD' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || LPAD((counter + 1)::TEXT, 3, '0');
  RETURN new_number;
END;
$$;

-- ============================================================
-- 16. Remove single cafe_settings enforcement
--     (each tenant gets their own settings row)
-- ============================================================

DROP TRIGGER IF EXISTS check_single_cafe_settings ON public.cafe_settings;
DROP FUNCTION IF EXISTS enforce_single_cafe_settings();

-- Replace with per-tenant uniqueness
CREATE UNIQUE INDEX idx_cafe_settings_tenant_unique ON public.cafe_settings(tenant_id);

-- ============================================================
-- 17. Self-service signup trigger
--     When a user signs up with signup metadata, auto-provision
--     their tenant, staff record, and default data.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_tenant_signup()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
  v_slug TEXT;
BEGIN
  -- Only process self-service signups (not admin-created users)
  IF NEW.raw_user_meta_data->>'signup' IS NULL THEN
    RETURN NEW;
  END IF;

  -- Generate URL-friendly slug from restaurant name
  v_slug := lower(regexp_replace(
    COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'restaurant'),
    '[^a-zA-Z0-9]+', '-', 'g'
  ));
  -- Append random suffix for uniqueness
  v_slug := v_slug || '-' || substr(gen_random_uuid()::TEXT, 1, 8);

  -- Create tenant
  INSERT INTO public.tenants (name, slug)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'My Restaurant'),
    v_slug
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

CREATE TRIGGER on_auth_user_created_tenant
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_tenant_signup();

-- ============================================================
-- 18. Grant permissions
-- ============================================================

GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_table_context(TEXT) TO anon;
