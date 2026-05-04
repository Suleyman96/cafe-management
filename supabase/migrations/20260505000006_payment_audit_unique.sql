-- ============================================================
-- Pre-release Blocker 6: payment audit row + per-request unique index.
-- ============================================================
--
-- Goal: every order_payments INSERT writes exactly one financial_audit_log
-- row in the same transaction, and that row carries the originating
-- client_request_id so reconciliation tooling can join 1:1 between
-- payments and audit entries even after a replay.
--
-- Why this exists at all:
--   The original audit hook in `update_order_payment_status` (added
--   in 20260419000002) was dropped when the multi-tenant hardening
--   migration 20260430000002 rewrote the trigger body to add tenant
--   parity checks. The rewrite kept the close-order / free-table logic
--   but lost the `log_order_financial_change('payment', …)` line. This
--   migration restores audit logging and adds dedupe semantics.
--
-- What changes:
--   1. ALTER financial_audit_log → ADD COLUMN triggered_by_request_id UUID.
--      Nullable because legacy rows pre-date this migration. New
--      payment audit rows always populate it.
--   2. Rewrite `update_order_payment_status` to write an audit row
--      directly (action='payment', triggered_by_request_id from
--      NEW.client_request_id, snapshot of order totals). The function
--      stays AFTER INSERT on order_payments — same trigger binding,
--      `CREATE OR REPLACE` swap.
--   3. Partial unique index on
--      (tenant_id, order_id, action, triggered_by_request_id) WHERE
--      action='payment' AND triggered_by_request_id IS NOT NULL. Defense
--      in depth on top of the order_payments
--      (tenant_id, client_request_id) unique index — if any future code
--      path bypasses the order_payments dedupe (or a backfill script
--      writes audit rows directly), the audit log itself still rejects
--      duplicates.
--
-- Why direct INSERT instead of log_order_financial_change(...):
--   The helper takes only (order_id, action, triggered_by) and would
--   need a new signature to thread triggered_by_request_id through.
--   Writing the audit row inline in the one trigger that has access to
--   NEW.client_request_id keeps the helper unchanged for the other
--   callers (recalculate_order_total, recalculate_on_discount_change)
--   that don't need the request_id.

BEGIN;

ALTER TABLE public.financial_audit_log
  ADD COLUMN IF NOT EXISTS triggered_by_request_id UUID;

COMMENT ON COLUMN public.financial_audit_log.triggered_by_request_id IS
  'Originating client_request_id of the mutation that produced this audit row, when known. Joins 1:1 with order_payments.client_request_id, refunds.client_request_id, etc. NULL on rows written before 20260505000006 or by triggers that do not have access to a client request id (e.g. order_items recalculation).';

-- Restore + extend the payment audit hook in update_order_payment_status.
-- Body is the 20260430000002 H7 version (tenant guard, terminal-state
-- close, table free) with an added INSERT into financial_audit_log
-- before the close transition so the snapshot is in the same transaction
-- as the payment row.
CREATE OR REPLACE FUNCTION public.update_order_payment_status() RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
DECLARE
  remaining NUMERIC(14, 4);
  total_paid NUMERIC(14, 4);
  order_table_id UUID;
  v_order_tenant_id UUID;
  v_subtotal NUMERIC(14, 4);
  v_tax NUMERIC(14, 4);
  v_discount_amount NUMERIC(14, 4);
  v_total NUMERIC(14, 4);
BEGIN
  SELECT tenant_id, table_id, subtotal, tax, discount_amount, total
    INTO v_order_tenant_id, order_table_id, v_subtotal, v_tax, v_discount_amount, v_total
  FROM public.orders WHERE id = NEW.order_id;

  IF v_order_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Order % not found', NEW.order_id;
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM v_order_tenant_id THEN
    RAISE EXCEPTION 'Tenant mismatch on payment for order %', NEW.order_id;
  END IF;

  -- Audit row first. Same transaction as the payment INSERT, so the row
  -- and its audit entry commit together. A payment doesn't change order
  -- totals (those flow from items/discounts), so old_* and new_* are
  -- identical — the row's purpose is to mark *that* a payment occurred,
  -- with the request_id so retries dedupe at the audit level too.
  INSERT INTO public.financial_audit_log (
    order_id, tenant_id, staff_id, action,
    old_subtotal, old_tax, old_discount_amount, old_total,
    new_subtotal, new_tax, new_discount_amount, new_total,
    triggered_by, triggered_by_request_id,
    details
  ) VALUES (
    NEW.order_id, v_order_tenant_id, NEW.received_by, 'payment',
    v_subtotal, v_tax, v_discount_amount, v_total,
    v_subtotal, v_tax, v_discount_amount, v_total,
    'trigger:update_order_payment_status', NEW.client_request_id,
    jsonb_build_object(
      'payment_id', NEW.id,
      'amount', NEW.amount,
      'payment_method', NEW.payment_method,
      'payment_type', NEW.payment_type
    )
  );

  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.order_payments
  WHERE order_id = NEW.order_id;

  remaining := public.get_order_remaining_balance(NEW.order_id);

  IF remaining <= 0 THEN
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

  RETURN NEW;
END;
$$;

-- Defense-in-depth dedupe at the audit-log level. The
-- `(tenant_id, client_request_id)` unique index on order_payments
-- (migration 20260428000002) already prevents a duplicate payment, so
-- the trigger can only fire once per request_id today. This index
-- closes the door on any future regression that lets a duplicate
-- payment row through.
--
-- Note on CONCURRENTLY: the Supabase CLI runs migrations inside a
-- pipelined transaction, where CONCURRENTLY is forbidden. Same
-- accommodation as 20260504000002_discount_audit_idempotency_index.
-- For production rollout against a populated table, build the index
-- manually outside any transaction first; the IF NOT EXISTS guard
-- makes the migration a no-op once the index is present.
CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_audit_payment_request
  ON public.financial_audit_log (tenant_id, order_id, action, triggered_by_request_id)
  WHERE action = 'payment' AND triggered_by_request_id IS NOT NULL;

COMMIT;
