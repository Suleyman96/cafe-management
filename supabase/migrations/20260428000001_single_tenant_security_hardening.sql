-- Single-tenant launch security hardening.
--
-- Closes the issues from the audit that bite even a 1-tenant deploy:
--   C6  orders_decrypted view bypasses RLS (anon could read all PII)
--   C7  any anon could free occupied tables
--   H1  any anon could cancel any new order / pending item
--   H2  any waiter could insert refunds (no role guard)
--   H3  transfer_table / transfer_order_items trusted client-supplied p_staff_id
--   H6  encrypt_pii / decrypt_pii callable by everyone
--   H8  clients could write stock_movements directly (forgeable quantity_after)
--   M6  no probe for PII encryption configuration
--   L3  delivery-token lookup unindexed
--
-- Cross-tenant issues (C1-C5, H4, H5, H7, M1, M2, M9) are deferred until the
-- second tenant onboards — they cannot be exploited with a single tenant.

BEGIN;

-- ============================================================
-- C6. orders_decrypted: enforce RLS on reads, drop anon access
-- ============================================================

-- security_invoker = on means the view runs with the caller's privileges,
-- so the underlying tenant_isolation policy on `orders` applies normally.
ALTER VIEW public.orders_decrypted SET (security_invoker = on);

-- Customer-web reaches order data through SECURITY DEFINER RPCs
-- (get_active_order_for_table, get_delivery_order). The decrypted view
-- is a staff-only convenience.
REVOKE SELECT ON public.orders_decrypted FROM anon;

-- ============================================================
-- C7. Drop policy that lets any anon free any occupied table
-- ============================================================

DROP POLICY IF EXISTS "Anon can free occupied tables" ON public.tables;

-- ============================================================
-- H1. Drop unscoped anon cancel policies
--     Scoped replacements (anon_cancel_early_orders) already exist
--     in 20260418000001 and require status + table/delivery context.
-- ============================================================

DROP POLICY IF EXISTS "Anon can cancel pending order items" ON public.order_items;
DROP POLICY IF EXISTS "Anon can cancel early-stage orders"  ON public.orders;

-- ============================================================
-- H2. Refunds: role-guard inserts, forbid update/delete
--     The /api/v1/orders/[id]/refunds route uses verifyAdmin +
--     service_role, which bypasses RLS. These policies only block
--     direct client writes from the wrapper.
-- ============================================================

CREATE POLICY "admin_or_owner_can_insert_refund" ON public.refunds
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_staff_role() IN ('admin', 'owner'));

-- Refunds are append-only; a refund record should never change after creation.
CREATE POLICY "no_refund_update" ON public.refunds
  FOR UPDATE TO authenticated USING (false);

CREATE POLICY "no_refund_delete" ON public.refunds
  FOR DELETE TO authenticated USING (false);

-- ============================================================
-- H3. transfer_table / transfer_order_items: ignore client-supplied
--     p_staff_id and derive the actor from auth.uid().
--     Signatures are preserved so wrapper callers don't need changes;
--     the parameter is now defensive-only and overwritten internally.
-- ============================================================

CREATE OR REPLACE FUNCTION public.transfer_table(
  p_order_id UUID,
  p_from_table_id UUID,
  p_to_table_id UUID,
  p_staff_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_status TEXT;
  v_actor_id UUID;
BEGIN
  -- Trust the session, not the parameter. p_staff_id is ignored.
  SELECT id INTO v_actor_id
  FROM public.staff
  WHERE auth_user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'No active staff record for current user';
  END IF;

  SELECT status INTO v_order_status
  FROM public.orders
  WHERE id = p_order_id AND table_id = p_from_table_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % does not belong to table %', p_order_id, p_from_table_id;
  END IF;

  IF v_order_status IN ('closed', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot transfer closed or cancelled order';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tables
    WHERE id = p_to_table_id AND status = 'closed'
  ) THEN
    RAISE EXCEPTION 'Target table is closed';
  END IF;

  UPDATE public.orders
  SET table_id = p_to_table_id, updated_at = NOW()
  WHERE id = p_order_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE table_id = p_from_table_id
      AND id != p_order_id
      AND status IN ('new', 'preparing', 'ready', 'served')
  ) THEN
    UPDATE public.tables
    SET status = 'free', current_session_id = NULL, updated_at = NOW()
    WHERE id = p_from_table_id;
  END IF;

  UPDATE public.tables
  SET status = 'occupied',
      current_session_id = p_order_id,
      occupied_at = NOW(),
      updated_at = NOW()
  WHERE id = p_to_table_id;

  INSERT INTO public.table_transfers (
    order_id, from_table_id, to_table_id, transferred_by, reason
  ) VALUES (
    p_order_id, p_from_table_id, p_to_table_id, v_actor_id, p_reason
  );

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_order_items(
  p_source_order_id UUID,
  p_destination_table_id UUID,
  p_items JSONB,
  p_staff_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dest_order_id UUID;
  v_source_table_id UUID;
  v_source_order_status VARCHAR(20);
  v_item RECORD;
  v_source_item RECORD;
  v_remaining_items INTEGER;
  v_actor_id UUID;
BEGIN
  -- Trust the session, not the parameter. p_staff_id is ignored.
  SELECT id INTO v_actor_id
  FROM public.staff
  WHERE auth_user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'No active staff record for current user';
  END IF;

  SELECT table_id, status INTO v_source_table_id, v_source_order_status
  FROM public.orders
  WHERE id = p_source_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source order not found';
  END IF;

  IF v_source_order_status IN ('closed', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot transfer items from a closed or cancelled order';
  END IF;

  IF v_source_table_id = p_destination_table_id THEN
    RAISE EXCEPTION 'Cannot transfer to the same table';
  END IF;

  SELECT id INTO v_dest_order_id
  FROM public.orders
  WHERE table_id = p_destination_table_id
    AND status IN ('new', 'preparing', 'ready', 'served')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_dest_order_id IS NULL THEN
    INSERT INTO public.orders (table_id, order_type, status, assigned_waiter_id)
    VALUES (p_destination_table_id, 'dine_in', 'new', v_actor_id)
    RETURNING id INTO v_dest_order_id;

    UPDATE public.tables
    SET status = 'occupied',
        current_session_id = v_dest_order_id,
        occupied_at = NOW(),
        updated_at = NOW()
    WHERE id = p_destination_table_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, quantity INTEGER)
  LOOP
    SELECT * INTO v_source_item
    FROM public.order_items
    WHERE id = v_item.item_id
      AND order_id = p_source_order_id
      AND status != 'cancelled';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item % not found in source order or is cancelled', v_item.item_id;
    END IF;

    IF v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Transfer quantity must be positive';
    END IF;

    IF v_item.quantity > v_source_item.quantity THEN
      RAISE EXCEPTION 'Transfer quantity (%) exceeds available quantity (%)',
        v_item.quantity, v_source_item.quantity;
    END IF;

    IF v_item.quantity >= v_source_item.quantity THEN
      DELETE FROM public.order_items WHERE id = v_item.item_id;

      INSERT INTO public.order_items (
        order_id, menu_item_id, item_name, quantity, item_price, notes, status
      ) VALUES (
        v_dest_order_id, v_source_item.menu_item_id, v_source_item.item_name,
        v_source_item.quantity, v_source_item.item_price, v_source_item.notes,
        v_source_item.status
      );
    ELSE
      UPDATE public.order_items
      SET quantity = quantity - v_item.quantity
      WHERE id = v_item.item_id;

      INSERT INTO public.order_items (
        order_id, menu_item_id, item_name, quantity, item_price, notes, status
      ) VALUES (
        v_dest_order_id, v_source_item.menu_item_id, v_source_item.item_name,
        v_item.quantity, v_source_item.item_price, v_source_item.notes,
        v_source_item.status
      );
    END IF;
  END LOOP;

  PERFORM public.calculate_order_total(p_source_order_id);
  PERFORM public.calculate_order_total(v_dest_order_id);

  SELECT COUNT(*) INTO v_remaining_items
  FROM public.order_items
  WHERE order_id = p_source_order_id AND status != 'cancelled';

  IF v_remaining_items = 0 THEN
    UPDATE public.orders
    SET status = 'cancelled',
        internal_notes = 'All items transferred to another table',
        updated_at = NOW()
    WHERE id = p_source_order_id;

    IF NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE table_id = v_source_table_id
        AND id != p_source_order_id
        AND status IN ('new', 'preparing', 'ready', 'served')
    ) THEN
      UPDATE public.tables
      SET status = 'free', current_session_id = NULL, updated_at = NOW()
      WHERE id = v_source_table_id;
    END IF;
  END IF;

  INSERT INTO public.table_transfers (
    order_id, from_table_id, to_table_id, transferred_by, reason
  ) VALUES (
    p_source_order_id, v_source_table_id, p_destination_table_id, v_actor_id, p_reason
  );

  RETURN v_dest_order_id;
END;
$$;

-- ============================================================
-- H6. Lock down PII helpers — only the trigger needs them.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.encrypt_pii(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrypt_pii(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encrypt_pii(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrypt_pii(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.encrypt_pii(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_pii(text) FROM authenticated;
-- The orders_decrypted view (security_invoker = on as of this migration)
-- runs as the caller, so it needs explicit grants for staff reads.
GRANT EXECUTE ON FUNCTION public.decrypt_pii(text) TO authenticated;

-- ============================================================
-- H8. Stock movements: append-only via service_role only.
--     Adjustments must go through /api/v1/stock/[id]/adjust which
--     uses the admin client and computes quantity_after server-side.
-- ============================================================

DROP POLICY IF EXISTS "Staff can insert stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Staff can update stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Admins can delete stock_movements" ON public.stock_movements;

-- Reads stay open to active staff (existing "Staff can view stock_movements"
-- and tenant_isolation policies still apply).

-- ============================================================
-- M6. PII encryption configuration probe
-- ============================================================

CREATE OR REPLACE FUNCTION public.pii_encryption_status()
RETURNS TABLE(configured BOOLEAN, round_trip_ok BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key TEXT;
  v_ciphertext TEXT;
  v_plaintext TEXT;
BEGIN
  v_key := current_setting('app.pii_encryption_key', true);

  IF v_key IS NULL OR v_key = '' THEN
    configured := false;
    round_trip_ok := false;
    RETURN NEXT;
    RETURN;
  END IF;

  configured := true;

  -- Encrypt/decrypt a canary to confirm pgcrypto + key actually work.
  BEGIN
    v_ciphertext := encode(extensions.pgp_sym_encrypt('canary', v_key), 'base64');
    v_plaintext := extensions.pgp_sym_decrypt(decode(v_ciphertext, 'base64'), v_key);
    round_trip_ok := (v_plaintext = 'canary');
  EXCEPTION WHEN OTHERS THEN
    round_trip_ok := false;
  END;

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pii_encryption_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pii_encryption_status() TO service_role;

-- ============================================================
-- L3. Index delivery-order lookups by access token.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_orders_delivery_token
  ON public.orders (delivery_access_token)
  WHERE order_type = 'delivery';

COMMIT;
