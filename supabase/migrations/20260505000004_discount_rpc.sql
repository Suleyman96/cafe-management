-- ============================================================
-- Pre-release Blocker 6: atomic discount UPDATE + audit insert via single RPC.
-- ============================================================
--
-- Goal: applying a discount writes a `discount_applied` row to
-- financial_audit_log atomically with the orders UPDATE, or neither
-- happens. Today's `applyDiscount` (apps/staff-web/src/lib/services/
-- discount-service.ts) is the only money mutation that's NOT already
-- atomic via triggers — refund audit is written by an AFTER INSERT
-- trigger on `refunds`, payment audit is written by the AFTER INSERT
-- trigger on `order_payments`, but the `discount_applied` row is
-- INSERTed by JS *after* a separate UPDATE on `orders` has committed.
-- If that INSERT fails, the discount sticks but the audit never lands.
--
-- The pre-fix service even has a `console.warn(...)` "best-effort"
-- branch for non-23505 audit failures — that branch is the smoking gun
-- this migration removes.
--
-- This RPC consolidates the four steps into one transaction:
--   1. Replay short-circuit: a prior call with the same
--      client_request_id already wrote the `discount_applied` audit
--      row. The discount UPDATE is idempotent on absolute values, so
--      we just return the current order with deduped=true.
--   2. Lock the order row and verify tenant.
--   3. UPDATE orders.discount_*. The existing trigger
--      `recalculate_on_discount_change` fires, recomputes totals, and
--      writes a `discount_change` audit row (separate from the
--      `discount_applied` row this RPC writes — they're complementary:
--      `discount_change` captures the numeric before/after,
--      `discount_applied` captures user intent + request_id).
--   4. INSERT the `discount_applied` audit row. The partial unique index
--      `uq_financial_audit_discount_client_request` (migration
--      20260504000002) serializes concurrent replays — one wins, the
--      loser raises 23505. Because this INSERT and the UPDATE in step 3
--      are in the same transaction, a 23505 here rolls back the entire
--      RPC transaction including the UPDATE. That's fine — the prior
--      caller's row is already in the agreed-upon state, and the
--      service handles the 23505 by short-circuiting on the next call's
--      lookup branch.
--
-- Authorization: same contract as create_refund_with_audit. The RPC
-- trusts `p_tenant_id` because the only legitimate caller is
-- `/api/v1/orders/[id]/discount` after `verifyAdmin`. SECURITY DEFINER
-- bypasses RLS, so we re-establish the boundary inside the function.
--
-- Sanity-cap validation (percentage 0–100, fixed ≤ subtotal, large-
-- discount reason requirement) STAYS in the service so error responses
-- have structured `fieldErrors` for the UI. The RPC only enforces
-- shape-of-last-resort: discount_type membership and value sign.
--
-- Error contract — the RPC RAISEs with sqlstate codes the service maps:
--   - 'order_not_found_in_tenant'    ERRCODE = no_data_found
--   - 'discount_value_invalid'       ERRCODE = check_violation
--   - 'discount_type_invalid'        ERRCODE = check_violation
--   - 23505 unique_violation         → service handles dedupe race
--
-- File split: same dollar-quoted-body splitter limitation as
-- 20260505000002_refund_rpc.sql. Grants live in
-- 20260505000005_discount_rpc_grants.sql.

CREATE OR REPLACE FUNCTION public.apply_discount_with_audit(
  p_order_id UUID,
  p_tenant_id UUID,
  p_discount_type TEXT,
  p_discount_value NUMERIC,
  p_discount_reason TEXT,
  p_discount_applied_by UUID,
  p_client_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_tenant UUID;
  v_subtotal NUMERIC;
  v_existing_audit_id UUID;
  v_updated_order RECORD;
  v_discount_amount NUMERIC;
  v_fraction NUMERIC;
  v_effective_value NUMERIC;
BEGIN
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'client_request_id is required'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_discount_type NOT IN ('none', 'percentage', 'fixed') THEN
    RAISE EXCEPTION 'discount_type_invalid'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_discount_value IS NULL OR p_discount_value < 0 THEN
    RAISE EXCEPTION 'discount_value_invalid'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Replay short-circuit. The discount UPDATE itself is idempotent on
  -- absolute values; the audit INSERT is the dedupe anchor. If a prior
  -- call with this client_request_id already wrote the audit row, the
  -- discount has already been applied — return the current order.
  SELECT id INTO v_existing_audit_id
  FROM public.financial_audit_log
  WHERE tenant_id = p_tenant_id
    AND order_id = p_order_id
    AND action = 'discount_applied'
    AND (details->>'client_request_id') = p_client_request_id::text;

  IF FOUND THEN
    SELECT id, subtotal, tax, total, discount_type, discount_value, discount_amount
    INTO v_updated_order
    FROM public.orders
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
      'order', to_jsonb(v_updated_order),
      'deduped', true
    );
  END IF;

  -- Lock order + verify tenant.
  SELECT tenant_id, subtotal INTO v_order_tenant, v_subtotal
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_tenant IS NULL OR v_order_tenant <> p_tenant_id THEN
    RAISE EXCEPTION 'order_not_found_in_tenant'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- When clearing a discount, write 0 regardless of incoming value so a
  -- stale UI value can't reactivate when the type flips back later.
  -- (Service also clamps; this is defense-in-depth.)
  v_effective_value := CASE WHEN p_discount_type = 'none' THEN 0 ELSE p_discount_value END;

  UPDATE public.orders
  SET
    discount_type = p_discount_type,
    discount_value = v_effective_value,
    discount_reason = p_discount_reason,
    discount_applied_by = p_discount_applied_by
  WHERE id = p_order_id;

  -- Re-read after recalculate_on_discount_change has finalized totals.
  SELECT id, subtotal, tax, total, discount_type, discount_value, discount_amount
  INTO v_updated_order
  FROM public.orders
  WHERE id = p_order_id;

  -- Audit row with user intent + request_id. Skip when type='none' to
  -- mirror the prior service contract (clearing a discount doesn't write
  -- an `applied` audit row — the trigger-written `discount_change` row
  -- already captures the numeric transition).
  IF p_discount_type <> 'none' THEN
    v_discount_amount := COALESCE(v_updated_order.discount_amount, 0);
    IF v_subtotal > 0 THEN
      v_fraction := v_discount_amount / v_subtotal;
    ELSE
      v_fraction := 0;
    END IF;

    INSERT INTO public.financial_audit_log (
      tenant_id,
      staff_id,
      order_id,
      action,
      details
    ) VALUES (
      p_tenant_id,
      p_discount_applied_by,
      p_order_id,
      'discount_applied',
      jsonb_build_object(
        'discount_type', p_discount_type,
        'discount_value', v_effective_value,
        'discount_amount', v_discount_amount,
        'reason', p_discount_reason,
        'fraction', v_fraction,
        'client_request_id', p_client_request_id
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'order', to_jsonb(v_updated_order),
    'deduped', false
  );
END;
$$;
