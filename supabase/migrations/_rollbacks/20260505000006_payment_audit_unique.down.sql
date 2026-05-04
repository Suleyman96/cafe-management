-- Rollback for 20260505000006_payment_audit_unique.sql.
-- Reverts the function body to the 20260430000002 H7 version (no audit
-- write), drops the unique index, and removes the column. Note: the
-- column is dropped only if no rows depend on it — a non-empty
-- `triggered_by_request_id` column means audit rows are referencing it
-- and we should preserve the data. In that case, leave the column,
-- drop only the function rewrite + index.

BEGIN;

DROP INDEX IF EXISTS public.uq_financial_audit_payment_request;

CREATE OR REPLACE FUNCTION public.update_order_payment_status() RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
DECLARE
  remaining DECIMAL(10, 2);
  total_paid DECIMAL(10, 2);
  order_table_id UUID;
  v_order_tenant_id UUID;
BEGIN
  SELECT tenant_id, table_id
    INTO v_order_tenant_id, order_table_id
  FROM public.orders WHERE id = NEW.order_id;

  IF v_order_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Order % not found', NEW.order_id;
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM v_order_tenant_id THEN
    RAISE EXCEPTION 'Tenant mismatch on payment for order %', NEW.order_id;
  END IF;

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

-- Drop the column ONLY if it has no non-null values. Audit rows are
-- forensically valuable; we'd rather leave a vestigial column than lose
-- request-id provenance.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.financial_audit_log
    WHERE triggered_by_request_id IS NOT NULL
    LIMIT 1
  ) THEN
    ALTER TABLE public.financial_audit_log DROP COLUMN IF EXISTS triggered_by_request_id;
  ELSE
    RAISE NOTICE 'financial_audit_log.triggered_by_request_id has data; preserving column.';
  END IF;
END $$;

COMMIT;
