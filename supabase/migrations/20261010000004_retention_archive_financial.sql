-- ============================================================
-- DR hardening: make data-retention LOSSLESS for table_transfers
-- ============================================================
--
-- Context / what was already fixed vs. what this migration fixes
-- --------------------------------------------------------------
-- The ORIGINAL retention function (20260424000004_data_retention.sql) archived
-- only orders / order_items / order_payments and then leaned on ON DELETE
-- CASCADE to clear refunds, table_transfers, and financial_audit_log — which
-- destroyed those money/audit rows UNARCHIVED (see its comment at lines 90-91).
--
-- A later migration (20260505000001_financial_tables_restrict_delete.sql)
-- already closed MOST of that hole: it switched refunds / order_payments /
-- financial_audit_log to ON DELETE RESTRICT, created archive.refunds +
-- archive.financial_audit_log, and rewrote run_data_retention() (8-column
-- RETURNS shape with refunds_archived + audit_archived) to archive and delete
-- those children explicitly. So refunds and financial_audit_log are ALREADY
-- archived losslessly today.
--
-- The ONE child still destroyed unarchived is **table_transfers**: its FK to
-- orders(id) is still ON DELETE CASCADE, and the current function's final
-- `DELETE FROM public.orders` cascade-deletes those rows with no archive copy
-- (the function's own comment calls this out: "cascades table_transfers").
-- table_transfers is the operational record of which order moved between
-- tables — losing it on retention erases that history.
--
-- This migration:
--   1. Creates archive.table_transfers (and re-asserts archive.refunds /
--      archive.financial_audit_log idempotently for self-documentation — they
--      already exist from 20260505000001, so those are no-ops).
--   2. Rewrites run_data_retention() via CREATE OR REPLACE, keeping the EXACT
--      same 8-column RETURNS shape (so public type generation does not drift —
--      see note below), copying the current body faithfully and adding a
--      table_transfers archival INSERT BEFORE the final DELETE FROM
--      public.orders (which still cascade-clears table_transfers from public).
--   3. financial_audit_log is compliance data — NO archive-side purge is added.
--
-- Type-generation note: `archive.*` tables are not in the exposed `public`
-- schema, so they never appear in packages/database/src/types/generated.ts.
-- run_data_retention()'s signature + RETURNS shape are UNCHANGED, so its entry
-- in the generated public Functions type is identical too. => no generated.ts
-- change is required by this migration.
--
-- ============================================================
-- ALIGN-ARCHIVE INVARIANT (read before adding a column to any hot table)
-- ============================================================
-- run_data_retention() archives with positional `INSERT INTO archive.X SELECT *
-- FROM public.X`. That requires archive.X to have the SAME columns, in the same
-- order, as public.X. Any future migration that ADDs a column to ANY of:
--   public.orders, public.order_items, public.order_payments,
--   public.refunds, public.table_transfers, public.financial_audit_log
-- MUST mirror that column onto the matching archive.* table (ALTER ... ADD
-- COLUMN always appends, so order stays aligned), or retention starts throwing
-- 42601 "INSERT has more expressions than target columns" the moment there is
-- an aged order to archive. The column-mirroring lives in
-- 20260605000002_align_archive_schema.sql; add new mirrors there. The
-- `data-retention` RLS test archives a real order + refund + audit + transfer
-- and fails if this drifts.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Archive tables (LIKE INCLUDING ALL => fresh column-parity for new tables;
--    no-op for the two that already exist from 20260505000001)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS archive.table_transfers    (LIKE public.table_transfers    INCLUDING ALL);
CREATE TABLE IF NOT EXISTS archive.refunds            (LIKE public.refunds            INCLUDING ALL);
CREATE TABLE IF NOT EXISTS archive.financial_audit_log (LIKE public.financial_audit_log INCLUDING ALL);

-- Drop inherited FK constraints on archive tables — LIKE INCLUDING ALL copies
-- the FKs to public.*, which would block inserts into the archive once the
-- source row is gone. (EXACT pattern from 20260424000004_data_retention.sql
-- lines 15-27; the loop only finds constraints that still exist, so it is
-- idempotent and leaves already-cleaned archive tables untouched.)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass AS table_name
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid::regclass::text LIKE 'archive.%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.table_name, r.conname);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 2. Rewrite run_data_retention() — add table_transfers archival.
--    Body copied faithfully from 20260505000001; IDENTICAL signature +
--    8-column RETURNS shape, SECURITY DEFINER, SET search_path='' => this is a
--    true CREATE OR REPLACE (no shape change, no type drift). The only
--    addition is the archive.table_transfers INSERT before DELETE orders.
-- ------------------------------------------------------------
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

    -- table_transfers is still ON DELETE CASCADE from orders(id): the final
    -- DELETE FROM public.orders below cascade-clears it. Archive it FIRST so
    -- the operational transfer history survives retention. (No ROW_COUNT is
    -- surfaced: the RETURNS shape is intentionally unchanged — see header.)
    INSERT INTO archive.table_transfers
    SELECT * FROM public.table_transfers WHERE order_id = ANY(v_order_ids)
    ON CONFLICT DO NOTHING;

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

    -- CASCADE from orders now clears the (already-archived) table_transfers
    -- and nulls customer_feedback.order_id.
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

-- ------------------------------------------------------------
-- 3. Grants (idempotent) — matching 20260424000004 lines 132-136.
-- ------------------------------------------------------------
GRANT USAGE ON SCHEMA archive TO service_role;
GRANT ALL ON archive.table_transfers    TO service_role;
GRANT ALL ON archive.refunds            TO service_role;
GRANT ALL ON archive.financial_audit_log TO service_role;
GRANT EXECUTE ON FUNCTION public.run_data_retention(INT, INT, INT, INT) TO service_role;

COMMIT;
