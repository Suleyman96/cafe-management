-- Harden the empty-order cleanup against the first-item race.
--
-- Background: fixing cleanup_empty_orders' `boolean = integer` bug
-- (20260613000001) so it actually cancels empty orders surfaced a latent
-- TOCTOU hole that the broken (always-throwing) function had masked. A first
-- item inserted concurrently with cleanup could leave a *cancelled order that
-- has items* (cleanup-empty-orders-concurrency.test.ts).
--
-- Two independent gaps had to be closed:
--
--  1. INSERT side — nothing stopped an item from being inserted onto an
--     already-cancelled order. If cleanup won the race, the item simply landed
--     on the cancelled row. Fix: a BEFORE INSERT trigger rejects items on
--     terminal (cancelled/closed) orders, taking FOR UPDATE on the parent so
--     the check serializes against a concurrent cancellation.
--
--  2. CLEANUP side — the cancellation used a single-statement re-check
--     (`UPDATE ... WHERE NOT EXISTS (items)`). Under READ COMMITTED + EvalPlanQual,
--     that subquery can fail to observe an item committed by a transaction the
--     UPDATE just waited on, so cleanup could cancel an order that had *just*
--     gained its first item. Fix: lock the candidate row FOR UPDATE, then
--     re-check emptiness in a SEPARATE statement — a fresh snapshot that
--     reliably sees anything committed before we took the lock.
--
-- Together: whichever side wins the row lock, the invariant holds — an order is
-- never both cancelled and non-empty.
--
--   insert wins → item lands; cleanup waits, re-check sees it, skips the cancel.
--   cancel wins → order cancelled empty; insert waits, sees 'cancelled', rejected.
--
-- No RLS impact (trigger on an existing table) and no generated-type change
-- (trigger functions returning `trigger` are not exposed as RPCs; the
-- cleanup_empty_orders signature is unchanged).

-- 1. CLEANUP side: lock-then-fresh-recheck.
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
    -- Lock the candidate row. A concurrent first-item insert (whose trigger
    -- also takes FOR UPDATE on this row, see below) is now forced to serialize
    -- with us. Re-read status under the lock and skip if it left the
    -- cancellable set while we waited.
    PERFORM 1 FROM public.orders
    WHERE id = r.order_id
      AND status IN ('new', 'pending_approval')
    FOR UPDATE;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Separate statement → fresh READ COMMITTED snapshot now that we hold the
    -- lock, so it reliably sees any order_item committed just before we
    -- acquired it. The prior single-statement NOT EXISTS re-check could miss
    -- such a row under EvalPlanQual and cancel a now-non-empty order.
    IF EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = r.order_id) THEN
      CONTINUE;
    END IF;

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
$function$;

-- 2. INSERT side: reject items on terminal orders.
CREATE OR REPLACE FUNCTION public.reject_items_on_terminal_order()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO ''
AS $function$
DECLARE
  v_status TEXT;
BEGIN
  -- FOR UPDATE so this check serializes against a concurrent cancellation
  -- (cleanup_empty_orders also locks the row FOR UPDATE).
  SELECT status INTO v_status
  FROM public.orders
  WHERE id = NEW.order_id
  FOR UPDATE;

  -- No visible parent row: defer to the FK constraint for the canonical error.
  IF v_status IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_status IN ('cancelled', 'closed') THEN
    RAISE EXCEPTION 'cannot add items to a % order', v_status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_reject_items_on_terminal_order ON public.order_items;
CREATE TRIGGER trg_reject_items_on_terminal_order
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_items_on_terminal_order();
