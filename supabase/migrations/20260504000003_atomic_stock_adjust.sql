-- Migration: Atomic stock-adjust RPC.
--
-- Root cause being fixed:
--   `apps/staff-web/src/lib/services/stock-service.ts:adjustStock` was a
--   client-side SELECT → compute-in-JS → INSERT movement → UPDATE quantity
--   pattern. Two concurrent "out 10" requests would both read quantity=100,
--   both compute new=90, both INSERT a movement (the ledger is correct —
--   two rows), and both UPDATE quantity to 90 (the on-hand count is wrong —
--   should be 80). Classic lost-update under READ COMMITTED. The existing
--   `client_request_id` unique index on stock_movements protects retries
--   but not genuinely-concurrent operations.
--
-- Fix:
--   Push the read-modify-write into a SECURITY DEFINER plpgsql function
--   that takes `SELECT ... FOR UPDATE` on the stock_items row inside a
--   single transaction. Concurrent callers serialize on the row lock and
--   the second one observes the first one's commit before computing.
--   Same pattern as cancel_order_item_qty (20260503000007).
--
-- Authorization:
--   This function trusts its `p_tenant_id` argument because callers are
--   route handlers using the service-role client (not user-context). The
--   route has already authenticated the staff record and derived the
--   tenant via `verifyPlan` / `verifyStaff`, so re-deriving from auth.uid()
--   here would be redundant. To make the contract explicit:
--     - REVOKE EXECUTE FROM PUBLIC (default grants are denied).
--     - GRANT EXECUTE TO service_role (the only legitimate caller).
--   The function still validates `p_tenant_id` against the row's tenant_id
--   as defense-in-depth: a bug that passes a wrong tenant_id from the
--   route raises a recognisable error instead of silently mutating.
--
-- Idempotency:
--   The existing partial unique index `stock_movements_tenant_client_request_id_uidx`
--   (migration 20260428000002) makes the INSERT idempotent on
--   (tenant_id, client_request_id). A retried request with the same key
--   raises 23505 inside the function, which propagates to the caller as a
--   PostgrestError with code='23505'. The service catches it, refetches the
--   stock item, and returns deduped=true (same handling as the pre-RPC
--   code path).
--
-- Error contract:
--   Domain errors RAISE with messages and ERRCODEs the service recognizes:
--     - 'Stock item not found'                    ERRCODE = no_data_found
--     - 'Stock item tenant mismatch'              ERRCODE = insufficient_privilege
--     - 'Insufficient stock for this adjustment'  ERRCODE = check_violation
--     - 'Invalid quantity_change'                 ERRCODE = check_violation
--   Service does substring/code matching to preserve the existing thrown-Error
--   surface so route + UI behaviour is unchanged.
--
-- Note on file split: the Supabase CLI's pgx-based migration splitter does
-- not reliably handle a dollar-quoted function definition followed by
-- COMMENT/REVOKE/GRANT in the same file (SQLSTATE 42601 "cannot insert
-- multiple commands into a prepared statement"). We define the function
-- here and put the COMMENT/REVOKE/GRANT in the paired follow-up migration
-- 20260504000004_atomic_stock_adjust_grants.sql so the splitter gets
-- single-statement files for the dollar-quoted body.

CREATE OR REPLACE FUNCTION public.adjust_stock_atomic(
  p_stock_item_id UUID,
  p_tenant_id UUID,
  p_movement_type TEXT,
  p_quantity_change NUMERIC,
  p_reason TEXT,
  p_performed_by UUID,
  p_client_request_id UUID
)
RETURNS public.stock_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.stock_items;
  v_new_quantity NUMERIC(12, 2);
  v_signed_change NUMERIC(12, 2);
BEGIN
  -- Reject zero/negative quantity_change up front so the math below stays
  -- meaningful. (movement_type='adjustment' uses p_quantity_change as the
  -- absolute target, which must still be >= 0.)
  IF p_quantity_change IS NULL OR p_quantity_change < 0 THEN
    RAISE EXCEPTION 'Invalid quantity_change'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_movement_type NOT IN ('in', 'out', 'adjustment') THEN
    RAISE EXCEPTION 'Invalid movement_type'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Lock the target row. Concurrent callers serialize here so the
  -- read-then-update sequence below is atomic with respect to other
  -- adjust_stock_atomic transactions on the same row.
  SELECT * INTO v_row
  FROM public.stock_items
  WHERE id = p_stock_item_id
    AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock item not found'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Tenant isolation: defense-in-depth (the route already verified) but a
  -- mistakenly-passed tenant_id should fail loudly, not silently mutate.
  IF v_row.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Stock item tenant mismatch'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Compute the new on-hand quantity and the signed ledger delta.
  IF p_movement_type = 'in' THEN
    v_new_quantity := v_row.quantity + p_quantity_change;
    v_signed_change := p_quantity_change;
  ELSIF p_movement_type = 'out' THEN
    v_new_quantity := v_row.quantity - p_quantity_change;
    v_signed_change := -p_quantity_change;
    IF v_new_quantity < 0 THEN
      RAISE EXCEPTION 'Insufficient stock for this adjustment'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE -- 'adjustment' — set on-hand to absolute target value
    v_new_quantity := p_quantity_change;
    v_signed_change := p_quantity_change - v_row.quantity;
  END IF;

  -- Insert ledger row. The unique index on
  --   (tenant_id, client_request_id) WHERE client_request_id IS NOT NULL
  -- makes this idempotent: a replay with the same key raises 23505 and
  -- the calling service treats that as a successful dedupe.
  INSERT INTO public.stock_movements (
    stock_item_id,
    movement_type,
    quantity_change,
    quantity_after,
    reason,
    performed_by,
    tenant_id,
    client_request_id
  ) VALUES (
    p_stock_item_id,
    p_movement_type,
    v_signed_change,
    v_new_quantity,
    p_reason,
    p_performed_by,
    p_tenant_id,
    p_client_request_id
  );

  -- Apply the on-hand update against the locked row. Returning the full
  -- row gives the caller the post-write state without a follow-up SELECT.
  UPDATE public.stock_items
     SET quantity = v_new_quantity,
         updated_at = NOW()
   WHERE id = p_stock_item_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
