-- ============================================================
-- Pre-release Blocker 3: ON DELETE RESTRICT on financial tables + archival path
-- ============================================================
--
-- Goal: make it impossible to delete an order — through manual SQL, a future
-- migration, or a retention bug — without first archiving its money records.
--
-- Today financial_audit_log, order_payments, and refunds all reference
-- orders(id) ON DELETE CASCADE. Any DELETE on orders silently destroys the
-- corresponding payment, refund, and audit-trail rows. The only thing
-- standing between an admin SQL session and a missing audit trail is human
-- discipline. This migration replaces that with a database-enforced
-- invariant.
--
-- What changes:
--   1. financial_audit_log, order_payments, refunds → ON DELETE RESTRICT.
--      A DELETE on orders now fails if any money rows still reference it.
--   2. New archive tables for refunds + financial_audit_log (archive.orders,
--      archive.order_items, archive.order_payments already existed in
--      20260424000004_data_retention.sql).
--   3. run_data_retention() rewritten: archives ALL children explicitly
--      (including refunds + financial_audit_log) and deletes them
--      explicitly, then deletes orders. No more reliance on CASCADE for
--      money tables. Order-items deletion happens BEFORE the audit-log
--      cleanup so trigger-written rows get caught.
--   4. DELETE on orders, order_payments, refunds, financial_audit_log
--      revoked from authenticated + anon roles (defense-in-depth on top of
--      RLS — service_role retains DELETE for retention + tests).

BEGIN;

-- ============================================================
-- 1. Switch FK constraints from CASCADE to RESTRICT
-- ============================================================

ALTER TABLE public.financial_audit_log
  DROP CONSTRAINT IF EXISTS financial_audit_log_order_id_fkey;
ALTER TABLE public.financial_audit_log
  ADD CONSTRAINT financial_audit_log_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;

ALTER TABLE public.order_payments
  DROP CONSTRAINT IF EXISTS order_payments_order_id_fkey;
ALTER TABLE public.order_payments
  ADD CONSTRAINT order_payments_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;

ALTER TABLE public.refunds
  DROP CONSTRAINT IF EXISTS refunds_order_id_fkey;
ALTER TABLE public.refunds
  ADD CONSTRAINT refunds_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;

-- ============================================================
-- 2. Add archive tables for refunds + financial_audit_log
-- ============================================================
-- archive.orders, archive.order_items, archive.order_payments are created
-- by 20260424000004_data_retention.sql. Add the two missing money tables.

CREATE TABLE IF NOT EXISTS archive.refunds
  (LIKE public.refunds INCLUDING ALL);

CREATE TABLE IF NOT EXISTS archive.financial_audit_log
  (LIKE public.financial_audit_log INCLUDING ALL);

-- Backfill schema drift on the pre-existing archive tables. They were
-- created via LIKE before 20260428000002_idempotency_keys.sql added
-- client_request_id, so retention's `INSERT INTO archive.x SELECT * FROM
-- public.x` raises "INSERT has more expressions than target columns".
ALTER TABLE archive.orders         ADD COLUMN IF NOT EXISTS client_request_id uuid;
ALTER TABLE archive.order_items    ADD COLUMN IF NOT EXISTS client_request_id uuid;
ALTER TABLE archive.order_payments ADD COLUMN IF NOT EXISTS client_request_id uuid;

-- LIKE INCLUDING ALL copies the foreign keys onto the archive copies, which
-- would block inserts into the archive whenever the source row is gone. Drop
-- them. (Same pattern as 20260424000004.)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass AS table_name
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid::regclass::text IN (
        'archive.refunds',
        'archive.financial_audit_log'
      )
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.table_name, r.conname);
  END LOOP;
END $$;

GRANT ALL ON archive.refunds TO service_role;
GRANT ALL ON archive.financial_audit_log TO service_role;

-- ============================================================
-- 3. Rewrite run_data_retention to archive money rows explicitly
-- ============================================================
-- The old function leaned on CASCADE to clear refunds, table_transfers,
-- and financial_audit_log. With RESTRICT in place that path now raises
-- foreign_key_violation, AND it would have been quietly destroying the
-- audit trail anyway. New flow:
--
--   archive children → delete order_items (lets the recalc trigger flush
--   any last audit row) → delete financial_audit_log → delete refunds →
--   delete order_payments → delete orders (cascades table_transfers,
--   nulls customer_feedback.order_id).
--
-- The signature gains refunds_archived + audit_archived columns, so the
-- prior function must be dropped first (CREATE OR REPLACE refuses
-- RETURNS-TABLE shape changes).

DROP FUNCTION IF EXISTS public.run_data_retention(INT, INT, INT, INT);

CREATE FUNCTION public.run_data_retention(
  p_order_retention_months INT DEFAULT 24,
  p_pii_retention_months INT DEFAULT 12,
  p_waiter_call_retention_months INT DEFAULT 6,
  p_waste_retention_months INT DEFAULT 24
)
RETURNS TABLE(
  orders_archived INT,
  items_archived INT,
  payments_archived INT,
  refunds_archived INT,
  audit_archived INT,
  pii_anonymized INT,
  waiter_calls_deleted INT,
  waste_logs_deleted INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_cutoff TIMESTAMPTZ;
  v_pii_cutoff TIMESTAMPTZ;
  v_call_cutoff TIMESTAMPTZ;
  v_waste_cutoff TIMESTAMPTZ;
  v_orders_archived INT := 0;
  v_items_archived INT := 0;
  v_payments_archived INT := 0;
  v_refunds_archived INT := 0;
  v_audit_archived INT := 0;
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
    -- Archive items + financial children before any DELETE.
    INSERT INTO archive.order_items
    SELECT * FROM public.order_items WHERE order_id = ANY(v_order_ids)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_items_archived = ROW_COUNT;

    INSERT INTO archive.order_payments
    SELECT * FROM public.order_payments WHERE order_id = ANY(v_order_ids)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_payments_archived = ROW_COUNT;

    INSERT INTO archive.refunds
    SELECT * FROM public.refunds WHERE order_id = ANY(v_order_ids)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_refunds_archived = ROW_COUNT;

    INSERT INTO archive.orders
    SELECT * FROM public.orders WHERE id = ANY(v_order_ids)
    ON CONFLICT DO NOTHING;

    -- Delete order_items first. The AFTER DELETE trigger
    -- recalculate_order_total fires per row and writes 'item_delete' audit
    -- rows; archive financial_audit_log AFTER this so we capture both the
    -- pre-existing and trigger-written entries.
    DELETE FROM public.order_items WHERE order_id = ANY(v_order_ids);

    INSERT INTO archive.financial_audit_log
    SELECT * FROM public.financial_audit_log WHERE order_id = ANY(v_order_ids)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_audit_archived = ROW_COUNT;

    -- Now clear the financial children (RESTRICT means we cannot rely on
    -- CASCADE) before deleting the orders themselves.
    DELETE FROM public.financial_audit_log WHERE order_id = ANY(v_order_ids);
    DELETE FROM public.refunds            WHERE order_id = ANY(v_order_ids);
    DELETE FROM public.order_payments     WHERE order_id = ANY(v_order_ids);

    DELETE FROM public.orders WHERE id = ANY(v_order_ids);
    GET DIAGNOSTICS v_orders_archived = ROW_COUNT;
  END IF;

  -- Anonymize delivery PII on non-archived orders past retention.
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
  refunds_archived := v_refunds_archived;
  audit_archived := v_audit_archived;
  pii_anonymized := v_pii_anonymized;
  waiter_calls_deleted := v_calls_deleted;
  waste_logs_deleted := v_waste_deleted;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_data_retention(INT, INT, INT, INT) TO service_role;

-- ============================================================
-- 4. Defense-in-depth: revoke DELETE on financial tables from clients
-- ============================================================
-- RLS already gates DELETE policies, but revoking the table privilege
-- closes the door for any future RLS policy regression. service_role
-- retains DELETE so retention + admin tooling continue to work.

REVOKE DELETE ON public.orders               FROM authenticated, anon;
REVOKE DELETE ON public.order_payments       FROM authenticated, anon;
REVOKE DELETE ON public.refunds              FROM authenticated, anon;
REVOKE DELETE ON public.financial_audit_log  FROM authenticated, anon;

COMMIT;
