-- cleanup_empty_orders TOCTOU fix.
--
-- The function in 20260430000002 walks a cursor of orders that look empty
-- (HAVING COUNT(oi.id) = 0), then issues an UPDATE per row. Under READ
-- COMMITTED a concurrent first-item insert can land between the cursor's
-- empty check and the UPDATE, yielding a cancelled order with items.
-- The concurrency probe in
-- packages/api-client/src/__tests__/rls/cleanup-empty-orders-concurrency.test.ts
-- demonstrates this race.
--
-- Fix: recheck the empty predicate inside the UPDATE itself so the latest
-- committed state of order_items is observed. If a concurrent insert beat
-- the UPDATE, the WHERE clause filters this row out and `FOUND` is false —
-- skip the table-free branch in that case so we don't free a table whose
-- order we no longer cancelled.

CREATE OR REPLACE FUNCTION public.cleanup_empty_orders(
  p_older_than_minutes INT DEFAULT 2
)
RETURNS TABLE(cancelled_order_id UUID, freed_table_id UUID)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r RECORD;
  v_other_active INT;
  v_tenant_id UUID;
  v_role TEXT;
  v_cancelled BOOLEAN;
BEGIN
  SELECT s.tenant_id, s.role INTO v_tenant_id, v_role
  FROM public.staff s
  WHERE s.auth_user_id = auth.uid() AND s.is_active = true;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF v_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Only admin or owner can clean up empty orders';
  END IF;

  FOR r IN
    SELECT o.id AS order_id, o.table_id
    FROM public.orders o
    LEFT JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.tenant_id = v_tenant_id
      AND o.status IN ('new', 'pending_approval')
      AND o.created_at < NOW() - (p_older_than_minutes || ' minutes')::INTERVAL
    GROUP BY o.id, o.table_id
    HAVING COUNT(oi.id) = 0
  LOOP
    -- Recheck the empty predicate inside the UPDATE. A concurrent
    -- order_items insert that committed between the cursor SELECT and now
    -- will be visible here under READ COMMITTED, and the WHERE clause
    -- filters this row out — `FOUND` becomes false and we skip the
    -- table-free path.
    UPDATE public.orders
    SET status = 'cancelled',
        internal_notes = 'Auto-cancelled: empty order',
        updated_at = NOW()
    WHERE id = r.order_id
      AND status IN ('new', 'pending_approval')
      AND NOT EXISTS (
        SELECT 1 FROM public.order_items oi WHERE oi.order_id = r.order_id
      );

    GET DIAGNOSTICS v_cancelled = ROW_COUNT;
    IF v_cancelled = 0 THEN
      CONTINUE;
    END IF;

    cancelled_order_id := r.order_id;
    freed_table_id := NULL;

    IF r.table_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_other_active
      FROM public.orders
      WHERE table_id = r.table_id
        AND id != r.order_id
        AND status IN ('pending_approval', 'new', 'preparing', 'ready', 'served');

      IF v_other_active = 0 THEN
        UPDATE public.tables
        SET status = 'free', occupied_at = NULL
        WHERE id = r.table_id;

        freed_table_id := r.table_id;
      END IF;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$;
