-- Rollback for 20260505000001_financial_tables_restrict_delete.sql.
--
-- Restores ON DELETE CASCADE on the three financial child tables, drops the
-- two new archive tables, restores the previous run_data_retention signature
-- (no refunds_archived / audit_archived columns), and re-grants DELETE on
-- the locked-down tables to authenticated/anon.
--
-- Note: archive.refunds / archive.financial_audit_log are dropped only if
-- empty. If a retention pass has already moved rows into them, you must
-- decide whether to keep them (data preservation) or move them somewhere
-- before re-running this rollback.

BEGIN;

-- 1. Restore CASCADE FKs.

ALTER TABLE public.financial_audit_log
  DROP CONSTRAINT IF EXISTS financial_audit_log_order_id_fkey;
ALTER TABLE public.financial_audit_log
  ADD CONSTRAINT financial_audit_log_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.order_payments
  DROP CONSTRAINT IF EXISTS order_payments_order_id_fkey;
ALTER TABLE public.order_payments
  ADD CONSTRAINT order_payments_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.refunds
  DROP CONSTRAINT IF EXISTS refunds_order_id_fkey;
ALTER TABLE public.refunds
  ADD CONSTRAINT refunds_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

-- 2. Drop the two added archive tables (only if empty — see header note).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM archive.refunds LIMIT 1)
     OR EXISTS (SELECT 1 FROM archive.financial_audit_log LIMIT 1) THEN
    RAISE NOTICE 'archive.refunds or archive.financial_audit_log is non-empty; preserving tables. '
      'Drop manually after relocating data if you really want to roll back.';
  ELSE
    DROP TABLE IF EXISTS archive.refunds;
    DROP TABLE IF EXISTS archive.financial_audit_log;
  END IF;
END $$;

-- 3. Restore the previous run_data_retention signature + body.

DROP FUNCTION IF EXISTS public.run_data_retention(INT, INT, INT, INT);

CREATE OR REPLACE FUNCTION public.run_data_retention(
  p_order_retention_months INT DEFAULT 24,
  p_pii_retention_months INT DEFAULT 12,
  p_waiter_call_retention_months INT DEFAULT 6,
  p_waste_retention_months INT DEFAULT 24
)
RETURNS TABLE(
  orders_archived INT,
  items_archived INT,
  payments_archived INT,
  pii_anonymized INT,
  waiter_calls_deleted INT,
  waste_logs_deleted INT
) AS $$
DECLARE
  v_order_cutoff TIMESTAMPTZ;
  v_pii_cutoff TIMESTAMPTZ;
  v_call_cutoff TIMESTAMPTZ;
  v_waste_cutoff TIMESTAMPTZ;
  v_orders_archived INT := 0;
  v_items_archived INT := 0;
  v_payments_archived INT := 0;
  v_pii_anonymized INT := 0;
  v_calls_deleted INT := 0;
  v_waste_deleted INT := 0;
  v_order_ids UUID[];
BEGIN
  v_order_cutoff := NOW() - (p_order_retention_months || ' months')::INTERVAL;
  v_pii_cutoff := NOW() - (p_pii_retention_months || ' months')::INTERVAL;
  v_call_cutoff := NOW() - (p_waiter_call_retention_months || ' months')::INTERVAL;
  v_waste_cutoff := NOW() - (p_waste_retention_months || ' months')::INTERVAL;

  SELECT ARRAY_AGG(id) INTO v_order_ids
  FROM public.orders
  WHERE status IN ('closed', 'cancelled')
    AND created_at < v_order_cutoff;

  IF v_order_ids IS NOT NULL AND array_length(v_order_ids, 1) > 0 THEN
    INSERT INTO archive.order_items
    SELECT * FROM public.order_items WHERE order_id = ANY(v_order_ids)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_items_archived = ROW_COUNT;

    INSERT INTO archive.order_payments
    SELECT * FROM public.order_payments WHERE order_id = ANY(v_order_ids)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_payments_archived = ROW_COUNT;

    INSERT INTO archive.orders
    SELECT * FROM public.orders WHERE id = ANY(v_order_ids)
    ON CONFLICT DO NOTHING;

    DELETE FROM public.orders WHERE id = ANY(v_order_ids);
    GET DIAGNOSTICS v_orders_archived = ROW_COUNT;
  END IF;

  UPDATE public.orders
  SET customer_name = 'REDACTED',
      customer_phone = 'REDACTED',
      delivery_address = 'REDACTED'
  WHERE order_type = 'delivery'
    AND created_at < v_pii_cutoff
    AND customer_name IS NOT NULL
    AND customer_name != 'REDACTED';
  GET DIAGNOSTICS v_pii_anonymized = ROW_COUNT;

  DELETE FROM public.waiter_calls WHERE created_at < v_call_cutoff;
  GET DIAGNOSTICS v_calls_deleted = ROW_COUNT;

  DELETE FROM public.waste_logs WHERE created_at < v_waste_cutoff;
  GET DIAGNOSTICS v_waste_deleted = ROW_COUNT;

  orders_archived := v_orders_archived;
  items_archived := v_items_archived;
  payments_archived := v_payments_archived;
  pii_anonymized := v_pii_anonymized;
  waiter_calls_deleted := v_calls_deleted;
  waste_logs_deleted := v_waste_deleted;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

GRANT EXECUTE ON FUNCTION public.run_data_retention(INT, INT, INT, INT) TO service_role;

-- 4. Re-grant DELETE on the locked-down tables.

GRANT DELETE ON public.orders               TO authenticated;
GRANT DELETE ON public.order_payments       TO authenticated;
GRANT DELETE ON public.refunds              TO authenticated;
GRANT DELETE ON public.financial_audit_log  TO authenticated;

COMMIT;
