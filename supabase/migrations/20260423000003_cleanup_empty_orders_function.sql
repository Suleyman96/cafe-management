-- Atomic cleanup of empty orders + table freeing.
-- Replaces the multi-step JS logic in packages/api-client/src/wrapper/orders.ts.
-- Runs as a single transaction so if the table update fails, the order cancellation
-- is also rolled back — preventing orphaned "occupied" tables.

CREATE OR REPLACE FUNCTION public.cleanup_empty_orders(
  p_older_than_minutes INT DEFAULT 2
)
RETURNS TABLE(cancelled_order_id UUID, freed_table_id UUID) AS $$
DECLARE
  r RECORD;
  v_other_active INT;
  v_tenant_id UUID;
BEGIN
  -- Derive tenant from the authenticated user's staff record
  SELECT s.tenant_id INTO v_tenant_id
  FROM public.staff s
  WHERE s.auth_user_id = auth.uid();

  IF v_tenant_id IS NULL THEN
    RETURN;
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
    UPDATE public.orders
    SET status = 'cancelled',
        internal_notes = 'Auto-cancelled: empty order',
        updated_at = NOW()
    WHERE id = r.order_id;

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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';
