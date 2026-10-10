-- ============================================================
-- DR hardening follow-up (MED-5): anonymize ARCHIVED PII + lock down archive.*
-- ============================================================
--
-- Independent review of PR #250 found two gaps in the retention/archive path:
--
--   MED-5a — PII lives forever in the archive. run_data_retention() archives the
--   full order row into archive.orders BEFORE deleting the hot copy. Step-4 of
--   the live function anonymizes delivery PII on the *surviving* public rows, but
--   the ARCHIVED copy keeps customer_name / customer_phone / delivery_address
--   verbatim — so "retention" never actually removes that PII, it just moves it
--   to a table nobody prunes. Fix: redact the archived copy's PII immediately
--   after archiving, matching the exact column names/values Step-4 already uses.
--
--   MED-5b — the archive schema has NO row-level security. The archive tables are
--   created with `LIKE public.X INCLUDING ALL`, which copies indexes/defaults but
--   NOT RLS (RLS is never inherited by LIKE). So the hot tables are RLS-guarded
--   while their archived twins — holding the same money + PII rows — are wide
--   open to any role that can reach the schema. Fix: ENABLE RLS + an explicit
--   RESTRICTIVE deny-all policy for authenticated/anon on every archive.* table.
--   service_role (retention writes, restore reads) has BYPASSRLS, and the
--   SECURITY DEFINER retention function runs as the superuser owner, so neither
--   is affected — only client roles are denied.
--
-- 8-COLUMN RETURNS SHAPE IS PRESERVED. This CREATE OR REPLACE copies the LIVE
-- merged body from 20261010000004_retention_archive_financial.sql byte-for-byte
-- and ADDs only the archive.orders PII-redaction UPDATE. The signature and the
-- 8-column RETURNS TABLE(orders_archived, items_archived, payments_archived,
-- refunds_archived, audit_archived, pii_anonymized, waiter_calls_deleted,
-- waste_logs_deleted) are UNCHANGED, so this is a true CREATE OR REPLACE — no
-- RETURNS-shape change, so the public Functions type in generated.ts is
-- identical and the DB-types drift gate stays green. No return-count semantics
-- change: the redaction UPDATE touches no counter (it writes archive.orders,
-- which has no surfaced count; pii_anonymized still counts ONLY the Step-4
-- public.orders delivery anonymization).
--
-- archive.* is not in the exposed `public` schema, so these tables never appear
-- in packages/database/src/types/generated.ts => no generated.ts regen needed.
--
-- See the ALIGN-ARCHIVE INVARIANT header in
-- 20261010000004_retention_archive_financial.sql before adding a column to any
-- hot table archived here.

BEGIN;

-- ------------------------------------------------------------
-- 1. Rewrite run_data_retention() — add archive.orders PII redaction.
--    Body copied faithfully from the LIVE 20261010000004; IDENTICAL signature +
--    8-column RETURNS shape, SECURITY DEFINER, SET search_path=''. The ONLY
--    addition is the `UPDATE archive.orders SET ...='REDACTED'` right after the
--    archive.orders INSERT (and before the hot deletes).
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

    -- MED-5a: redact PII in the ARCHIVED copy. The hot copy is deleted below;
    -- the point is that the retained/archived copy must NOT keep customer PII
    -- forever. Unconditional over the just-archived ids (dine-in/takeout rows
    -- carry null PII, which simply becomes 'REDACTED'). Same column names +
    -- 'REDACTED' sentinel as the Step-4 public anonymization below. This writes
    -- archive.orders only — no surfaced counter changes.
    UPDATE archive.orders
    SET customer_name = 'REDACTED',
        customer_phone = 'REDACTED',
        delivery_address = 'REDACTED'
    WHERE id = ANY(v_order_ids);

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

GRANT EXECUTE ON FUNCTION public.run_data_retention(INT, INT, INT, INT) TO service_role;

-- ------------------------------------------------------------
-- 2. MED-5b: RLS deny-all on every archive.* table.
--    LIKE ... INCLUDING ALL does NOT copy RLS, so the archive twins of the
--    RLS-guarded hot tables were unprotected. Enable RLS + an explicit
--    RESTRICTIVE deny-all for authenticated/anon. service_role has BYPASSRLS
--    (retention writes + restore reads), and the SECURITY DEFINER function runs
--    as its superuser owner — neither is affected. We do NOT use FORCE ROW LEVEL
--    SECURITY: that would also subject the owner, and we rely on the owner
--    bypass for the function's archive INSERTs.
--    Idempotent: ENABLE is a no-op if already on; DROP POLICY IF EXISTS then
--    CREATE makes the policy re-runnable.
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'orders', 'order_items', 'order_payments',
    'refunds', 'table_transfers', 'financial_audit_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE archive.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS archive_deny_all ON archive.%I', t);
    EXECUTE format(
      'CREATE POLICY archive_deny_all ON archive.%I AS RESTRICTIVE '
      || 'FOR ALL TO authenticated, anon USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;

COMMIT;
