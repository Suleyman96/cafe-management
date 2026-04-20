-- Financial audit log for order total changes.
-- Tracks every modification to monetary fields on orders, who/what triggered it, and before/after values.

BEGIN;

-- ========================================
-- 1. Create audit log table
-- ========================================

CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  action TEXT NOT NULL,  -- 'item_insert', 'item_update', 'item_delete', 'discount_change', 'payment', 'refund'
  -- Before values
  old_subtotal NUMERIC(14, 4),
  old_tax NUMERIC(14, 4),
  old_discount_amount NUMERIC(14, 4),
  old_total NUMERIC(14, 4),
  -- After values
  new_subtotal NUMERIC(14, 4),
  new_tax NUMERIC(14, 4),
  new_discount_amount NUMERIC(14, 4),
  new_total NUMERIC(14, 4),
  -- Context
  triggered_by TEXT,  -- 'trigger:recalculate_on_item_insert', 'trigger:recalculate_on_discount_change', etc.
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for looking up audit trail per order
CREATE INDEX idx_financial_audit_order ON financial_audit_log (order_id, created_at DESC);
-- Index for tenant-scoped queries
CREATE INDEX idx_financial_audit_tenant ON financial_audit_log (tenant_id, created_at DESC);

-- RLS
ALTER TABLE financial_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins/owners can read audit logs
CREATE POLICY "admin_read_audit_log" ON financial_audit_log
  FOR SELECT TO authenticated
  USING (public.get_my_staff_role() IN ('admin', 'owner'));

-- Tenant isolation
CREATE POLICY "tenant_isolation" ON financial_audit_log
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- No direct inserts from clients — only triggers write to this table
-- (Triggers use SECURITY DEFINER which bypasses RLS)

-- ========================================
-- 2. Create audit logging function
-- ========================================

CREATE OR REPLACE FUNCTION public.log_order_financial_change(
  p_order_id UUID,
  p_action TEXT,
  p_triggered_by TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT tenant_id, subtotal, tax, discount_amount, total
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF v_order IS NULL THEN RETURN; END IF;

  INSERT INTO public.financial_audit_log (
    order_id, tenant_id, action,
    old_subtotal, old_tax, old_discount_amount, old_total,
    triggered_by
  ) VALUES (
    p_order_id, v_order.tenant_id, p_action,
    v_order.subtotal, v_order.tax, v_order.discount_amount, v_order.total,
    p_triggered_by
  );
END;
$$;

-- ========================================
-- 3. Create function to finalize audit entry with new values
-- ========================================

CREATE OR REPLACE FUNCTION public.finalize_audit_entry(
  p_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT subtotal, tax, discount_amount, total
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF v_order IS NULL THEN RETURN; END IF;

  -- Update the most recent audit entry for this order that has no new_total yet
  UPDATE public.financial_audit_log
  SET
    new_subtotal = v_order.subtotal,
    new_tax = v_order.tax,
    new_discount_amount = v_order.discount_amount,
    new_total = v_order.total
  WHERE order_id = p_order_id
    AND new_total IS NULL
    AND id = (
      SELECT id FROM public.financial_audit_log
      WHERE order_id = p_order_id AND new_total IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    );
END;
$$;

-- ========================================
-- 4. Update calculate_order_total to log changes
-- ========================================

CREATE OR REPLACE FUNCTION public.calculate_order_total(order_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  calculated_subtotal NUMERIC(14, 4);
  calculated_tax NUMERIC(14, 4);
  calculated_total NUMERIC(14, 4);
  order_discount_type VARCHAR(10);
  order_discount_value NUMERIC(14, 4);
  calculated_discount NUMERIC(14, 4);
  order_delivery_fee NUMERIC(14, 4);
  settings_tax_enabled BOOLEAN;
  settings_tax_percentage NUMERIC(7, 4);
  taxable_amount NUMERIC(14, 4);
BEGIN
  SELECT tax_enabled, tax_percentage
  INTO settings_tax_enabled, settings_tax_percentage
  FROM public.cafe_settings
  LIMIT 1;

  SELECT COALESCE(SUM(item_price * quantity), 0)
  INTO calculated_subtotal
  FROM public.order_items
  WHERE order_id = order_uuid
    AND status != 'cancelled';

  SELECT
    COALESCE(discount_type, 'none'),
    COALESCE(discount_value, 0),
    COALESCE(delivery_fee, 0)
  INTO order_discount_type, order_discount_value, order_delivery_fee
  FROM public.orders
  WHERE id = order_uuid;

  IF order_discount_type = 'percentage' THEN
    calculated_discount := LEAST(calculated_subtotal, calculated_subtotal * order_discount_value / 100);
  ELSIF order_discount_type = 'fixed' THEN
    calculated_discount := LEAST(calculated_subtotal, order_discount_value);
  ELSE
    calculated_discount := 0;
  END IF;

  taxable_amount := calculated_subtotal - calculated_discount;

  IF settings_tax_enabled = true AND settings_tax_percentage > 0 THEN
    calculated_tax := taxable_amount * (settings_tax_percentage / 100);
    calculated_total := taxable_amount + calculated_tax + order_delivery_fee;
  ELSE
    calculated_tax := 0;
    calculated_total := taxable_amount + order_delivery_fee;
  END IF;

  UPDATE public.orders
  SET
    subtotal = calculated_subtotal,
    tax = calculated_tax,
    discount_amount = calculated_discount,
    total = calculated_total,
    updated_at = NOW()
  WHERE id = order_uuid;

  -- Finalize the audit entry with the new values
  PERFORM public.finalize_audit_entry(order_uuid);
END;
$$;

-- ========================================
-- 5. Update recalculate_order_total trigger to log before recalc
-- ========================================

CREATE OR REPLACE FUNCTION public.recalculate_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id UUID;
  v_action TEXT;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  v_action := CASE TG_OP
    WHEN 'INSERT' THEN 'item_insert'
    WHEN 'UPDATE' THEN 'item_update'
    WHEN 'DELETE' THEN 'item_delete'
  END;

  -- Log before state
  PERFORM public.log_order_financial_change(v_order_id, v_action, 'trigger:recalculate_on_' || lower(TG_OP));

  -- Recalculate (this also finalizes the audit entry)
  PERFORM public.calculate_order_total(v_order_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ========================================
-- 6. Update discount change trigger to log
-- ========================================

CREATE OR REPLACE FUNCTION public.recalculate_on_discount_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.discount_type IS DISTINCT FROM NEW.discount_type
    OR OLD.discount_value IS DISTINCT FROM NEW.discount_value THEN

    -- Log before state
    PERFORM public.log_order_financial_change(NEW.id, 'discount_change', 'trigger:recalculate_on_discount_change');

    -- Recalculate (this also finalizes the audit entry)
    PERFORM public.calculate_order_total(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- ========================================
-- 7. Add audit logging to payment status trigger
-- ========================================

CREATE OR REPLACE FUNCTION public.update_order_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  remaining NUMERIC(14, 4);
  total_paid NUMERIC(14, 4);
  order_table_id UUID;
BEGIN
  -- Log the payment event
  PERFORM public.log_order_financial_change(NEW.order_id, 'payment', 'trigger:update_order_payment_status');

  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.order_payments
  WHERE order_id = NEW.order_id;

  remaining := public.get_order_remaining_balance(NEW.order_id);

  IF remaining <= 0 THEN
    SELECT table_id INTO order_table_id
    FROM public.orders
    WHERE id = NEW.order_id;

    UPDATE public.orders
    SET
      status = 'closed',
      paid_at = NOW(),
      closed_at = NOW(),
      payment_method = 'split',
      updated_at = NOW()
    WHERE id = NEW.order_id;

    IF order_table_id IS NOT NULL THEN
      UPDATE public.tables
      SET
        status = 'free',
        current_session_id = NULL,
        updated_at = NOW()
      WHERE id = order_table_id;
    END IF;
  END IF;

  -- Finalize with new values (status may have changed)
  PERFORM public.finalize_audit_entry(NEW.order_id);

  RETURN NEW;
END;
$$;

COMMIT;
