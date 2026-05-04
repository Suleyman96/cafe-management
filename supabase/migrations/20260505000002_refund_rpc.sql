-- ============================================================
-- Pre-release Blocker 6: atomic refund + audit insert via single Postgres RPC.
-- ============================================================
--
-- Goal: a refund row and its financial_audit_log row commit together or
-- not at all. No "best-effort" logging from JS where the refund can land
-- but the audit row never makes it.
--
-- Today's flow (refund-service.ts):
--   1. SELECT existing refund by client_request_id (dedupe lookup)
--   2. SELECT order to verify tenant
--   3. INSERT refund — fires
--        • validate_refund_amount  (BEFORE) — balance + tenant guard
--        • log_refund_on_insert    (AFTER)  — writes financial_audit_log
--      The trigger pair already runs in the same transaction as the INSERT,
--      so refund + audit *are* atomic today. What's NOT atomic is the
--      dedupe lookup → INSERT pair: the JS helper closes that window via
--      `findOrCreateByClientRequestId` and a 23505 race-recovery refetch,
--      which works but is two transactions and a JS-side state machine.
--
-- This migration moves all four steps (dedupe lookup, order lock, refund
-- INSERT, audit row written by trigger) into a single SECURITY DEFINER
-- plpgsql function. Same atomic guarantee, fewer round trips, and the
-- dedupe race is now a true serialization on the order row lock rather
-- than a JS-side recovery branch.
--
-- Authorization: this RPC trusts its `p_tenant_id` argument because the
-- only legitimate caller is `/api/v1/orders/[id]/refunds` after
-- `verifyAdmin`. SECURITY DEFINER bypasses RLS, so we re-establish the
-- boundary inside the function:
--   - REVOKE EXECUTE FROM PUBLIC, anon, authenticated.
--   - GRANT EXECUTE TO service_role only.
--   - The function still validates `p_tenant_id` against the order's
--     tenant_id as defense-in-depth.
--
-- Idempotency: same partial unique index on
-- `refunds (tenant_id, client_request_id)` (migration 20260428000002)
-- enforces "at most one refund per client_request_id". The RPC's
-- pre-INSERT SELECT short-circuits sequential retries; concurrent
-- replays serialize on the order-row lock and the loser sees the
-- winner's row in the dedupe lookup on its retry.
--
-- Error contract — the RPC RAISEs with sqlstate codes the service maps:
--   - 'order_not_found_in_tenant'     ERRCODE = no_data_found  (NotFoundError 404)
--   - 'refund_exceeds_available'      ERRCODE = check_violation (ConflictError 409)
--   - 'refund_tenant_mismatch'        ERRCODE = check_violation (ConflictError 409)
--   - 23505 unique_violation          → service handles dedupe race recovery
--
-- Note on file split: the Supabase CLI's pgx-based migration splitter
-- does not reliably handle a dollar-quoted function definition followed
-- by COMMENT/REVOKE/GRANT in the same file (SQLSTATE 42601 "cannot insert
-- multiple commands into a prepared statement"). Grants live in the
-- paired follow-up migration `20260505000003_refund_rpc_grants.sql`.

CREATE OR REPLACE FUNCTION public.create_refund_with_audit(
  p_order_id UUID,
  p_tenant_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_refund_method TEXT,
  p_processed_by UUID,
  p_order_item_ids UUID[],
  p_notes TEXT,
  p_client_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing public.refunds%ROWTYPE;
  v_refund public.refunds%ROWTYPE;
  v_order_tenant UUID;
  v_response JSONB;
BEGIN
  -- The route's Zod schema rejects missing keys at the edge, but the
  -- function is the last line of defense for any future internal caller
  -- that might bypass the route layer.
  IF p_client_request_id IS NULL THEN
    RAISE EXCEPTION 'client_request_id is required'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Fast path: a prior commit with this key already produced a refund.
  -- Return it without a second INSERT (which would 23505 on the unique
  -- index anyway, but this saves a round trip on sequential retries).
  SELECT * INTO v_existing
  FROM public.refunds
  WHERE tenant_id = p_tenant_id
    AND client_request_id = p_client_request_id;

  IF FOUND THEN
    SELECT jsonb_build_object(
      'refund', to_jsonb(r) || jsonb_build_object(
        'processed_by_staff', CASE
          WHEN s.id IS NOT NULL THEN jsonb_build_object('full_name', s.full_name, 'role', s.role)
          ELSE NULL
        END
      ),
      'deduped', true
    )
    INTO v_response
    FROM public.refunds r
    LEFT JOIN public.staff s ON s.id = r.processed_by
    WHERE r.id = v_existing.id;
    RETURN v_response;
  END IF;

  -- Lock the order row + verify tenant. The trigger
  -- validate_refund_amount also takes this lock, but acquiring it here
  -- earlier closes the lookup-then-insert window against a concurrent
  -- replay with the same client_request_id.
  SELECT tenant_id INTO v_order_tenant
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order_tenant IS NULL OR v_order_tenant <> p_tenant_id THEN
    RAISE EXCEPTION 'order_not_found_in_tenant'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- INSERT the refund. This is the atomicity anchor — both the BEFORE
  -- balance/tenant trigger and the AFTER audit trigger run in this
  -- same transaction, so any failure rolls back the refund row too.
  INSERT INTO public.refunds (
    order_id,
    tenant_id,
    amount,
    reason,
    refund_method,
    processed_by,
    order_item_ids,
    notes,
    client_request_id
  ) VALUES (
    p_order_id,
    p_tenant_id,
    p_amount,
    p_reason,
    p_refund_method,
    p_processed_by,
    p_order_item_ids,
    p_notes,
    p_client_request_id
  )
  RETURNING * INTO v_refund;

  SELECT jsonb_build_object(
    'refund', to_jsonb(r) || jsonb_build_object(
      'processed_by_staff', CASE
        WHEN s.id IS NOT NULL THEN jsonb_build_object('full_name', s.full_name, 'role', s.role)
        ELSE NULL
      END
    ),
    'deduped', false
  )
  INTO v_response
  FROM public.refunds r
  LEFT JOIN public.staff s ON s.id = r.processed_by
  WHERE r.id = v_refund.id;

  RETURN v_response;
END;
$$;
