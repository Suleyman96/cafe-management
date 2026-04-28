-- Rollback for 20260428000001_single_tenant_security_hardening.sql
-- Restores the pre-migration policies. Use only if a regression is traced
-- to one of the hardening steps and you need a fast revert.

BEGIN;

-- L3. Drop the delivery token index
DROP INDEX IF EXISTS public.idx_orders_delivery_token;

-- M6. Drop the PII probe
DROP FUNCTION IF EXISTS public.pii_encryption_status();

-- H8. Restore stock_movements client-write policies
CREATE POLICY "Staff can insert stock_movements" ON public.stock_movements
  FOR INSERT TO authenticated WITH CHECK (public.is_active_staff());
CREATE POLICY "Staff can update stock_movements" ON public.stock_movements
  FOR UPDATE TO authenticated USING (public.is_active_staff());
CREATE POLICY "Admins can delete stock_movements" ON public.stock_movements
  FOR DELETE TO authenticated
  USING (public.get_my_staff_role() = ANY (ARRAY['admin', 'owner']));

-- H6. Restore PII helper grants
GRANT EXECUTE ON FUNCTION public.encrypt_pii(text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_pii(text) TO PUBLIC;

-- H3. Restore the original transfer_table / transfer_order_items bodies that
-- trusted p_staff_id. (Body kept as-was in 00000000000000_baseline.sql.)
-- NOTE: this re-opens the audit-forge issue. Only run if rolling back fully.
CREATE OR REPLACE FUNCTION public.transfer_table(
  p_order_id UUID, p_from_table_id UUID, p_to_table_id UUID,
  p_staff_id UUID, p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_order_status TEXT;
BEGIN
  SELECT status INTO v_order_status FROM public.orders
   WHERE id = p_order_id AND table_id = p_from_table_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order % does not belong to table %', p_order_id, p_from_table_id; END IF;
  IF v_order_status IN ('closed','cancelled') THEN RAISE EXCEPTION 'Cannot transfer closed or cancelled order'; END IF;
  IF EXISTS (SELECT 1 FROM public.tables WHERE id = p_to_table_id AND status = 'closed') THEN
    RAISE EXCEPTION 'Target table is closed';
  END IF;
  UPDATE public.orders SET table_id = p_to_table_id, updated_at = NOW() WHERE id = p_order_id;
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE table_id = p_from_table_id
                   AND id != p_order_id AND status IN ('new','preparing','ready','served')) THEN
    UPDATE public.tables SET status='free', current_session_id=NULL, updated_at=NOW() WHERE id = p_from_table_id;
  END IF;
  UPDATE public.tables SET status='occupied', current_session_id=p_order_id,
         occupied_at=NOW(), updated_at=NOW() WHERE id = p_to_table_id;
  INSERT INTO public.table_transfers (order_id, from_table_id, to_table_id, transferred_by, reason)
   VALUES (p_order_id, p_from_table_id, p_to_table_id, p_staff_id, p_reason);
  RETURN TRUE;
END $$;

-- transfer_order_items rollback omitted: re-run baseline body if needed.
-- (Reverting that function in isolation is risky; safer to redeploy baseline.)

-- H2. Drop refund role guards
DROP POLICY IF EXISTS "admin_or_owner_can_insert_refund" ON public.refunds;
DROP POLICY IF EXISTS "no_refund_update" ON public.refunds;
DROP POLICY IF EXISTS "no_refund_delete" ON public.refunds;

-- H1. Restore unscoped anon cancel policies
CREATE POLICY "Anon can cancel pending order items" ON public.order_items
  FOR UPDATE USING (status = 'pending') WITH CHECK (status = 'cancelled');
CREATE POLICY "Anon can cancel early-stage orders" ON public.orders
  FOR UPDATE USING (status IN ('pending_approval','new')) WITH CHECK (status = 'cancelled');

-- C7. Restore unscoped anon free-table policy
CREATE POLICY "Anon can free occupied tables" ON public.tables
  FOR UPDATE USING (status = 'occupied') WITH CHECK (status = 'free');

-- C6. Re-grant anon access and revert view to definer-rights mode
GRANT SELECT ON public.orders_decrypted TO anon;
ALTER VIEW public.orders_decrypted SET (security_invoker = off);

COMMIT;
