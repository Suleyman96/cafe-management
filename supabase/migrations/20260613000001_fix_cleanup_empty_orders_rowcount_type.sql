-- Fix: cleanup_empty_orders() raised "operator does not exist: boolean = integer".
--
-- The TOCTOU re-check (20260504000001) reads the UPDATE's affected-row count via
-- `GET DIAGNOSTICS v_cancelled = ROW_COUNT` and then branches on `IF v_cancelled = 0`.
-- ROW_COUNT is an integer, but `v_cancelled` was declared BOOLEAN — so the
-- comparison `v_cancelled = 0` is `boolean = integer`, which has no operator.
-- This throws every time the function actually finds an empty order to cancel
-- (the bug lives inside the loop body), surfacing as a 500 on the periodic
-- "auto-cancel stale empty orders" call and an error toast on the tables screen.
--
-- Fix is a one-type change: declare the row-count holder as INT. Function body is
-- otherwise byte-for-byte the same as 20260504000001.

CREATE OR REPLACE FUNCTION public.cleanup_empty_orders(p_older_than_minutes integer DEFAULT 2)
  RETURNS TABLE(cancelled_order_id uuid, freed_table_id uuid)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  r RECORD;
  v_other_active INT;
  v_tenant_id UUID;
  v_role TEXT;
  v_cancelled INT;  -- holds GET DIAGNOSTICS ROW_COUNT (was mistakenly BOOLEAN)
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
$function$;
