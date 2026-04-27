-- ============================================================
-- SCALE-25: Data retention — archive old orders, anonymize PII, purge logs
-- ============================================================

-- 1. Archive schema
CREATE SCHEMA IF NOT EXISTS archive;

-- 2. Archive tables (same structure, no FK constraints)
CREATE TABLE IF NOT EXISTS archive.orders (LIKE public.orders INCLUDING ALL);
CREATE TABLE IF NOT EXISTS archive.order_items (LIKE public.order_items INCLUDING ALL);
CREATE TABLE IF NOT EXISTS archive.order_payments (LIKE public.order_payments INCLUDING ALL);

-- Drop inherited FK constraints on archive tables — they reference public tables
-- and would block inserts into the archive.
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

-- 3. Data retention function
--
-- IMPORTANT: order_items, order_payments, refunds, table_transfers, and
-- financial_audit_log all have ON DELETE CASCADE from orders(id). We must
-- archive child rows BEFORE deleting orders, or they'll be cascade-deleted.
--
-- SCHEDULING OPTIONS:
-- Option A (Supabase Pro): Enable pg_cron and schedule:
--   SELECT cron.schedule('data-retention', '0 3 * * 0', $$ SELECT run_data_retention(); $$);
-- Option B (External): Call POST /api/v1/admin/retention via cron service
-- Option C (Manual): Run via Supabase Dashboard SQL editor
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

  -- Step 1: Collect order IDs to archive
  SELECT ARRAY_AGG(id) INTO v_order_ids
  FROM public.orders
  WHERE status IN ('closed', 'cancelled')
    AND created_at < v_order_cutoff;

  IF v_order_ids IS NOT NULL AND array_length(v_order_ids, 1) > 0 THEN
    -- Step 2: Archive child rows BEFORE deleting orders (CASCADE would destroy them)
    INSERT INTO archive.order_items
    SELECT * FROM public.order_items WHERE order_id = ANY(v_order_ids)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_items_archived = ROW_COUNT;

    INSERT INTO archive.order_payments
    SELECT * FROM public.order_payments WHERE order_id = ANY(v_order_ids)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_payments_archived = ROW_COUNT;

    -- Step 3: Archive and delete orders (CASCADE deletes remaining children:
    -- refunds, table_transfers, financial_audit_log)
    INSERT INTO archive.orders
    SELECT * FROM public.orders WHERE id = ANY(v_order_ids)
    ON CONFLICT DO NOTHING;

    DELETE FROM public.orders WHERE id = ANY(v_order_ids);
    GET DIAGNOSTICS v_orders_archived = ROW_COUNT;
  END IF;

  -- Step 4: Anonymize delivery PII on non-archived orders past retention
  UPDATE public.orders
  SET customer_name = 'REDACTED',
      customer_phone = 'REDACTED',
      delivery_address = 'REDACTED'
  WHERE order_type = 'delivery'
    AND created_at < v_pii_cutoff
    AND customer_name IS NOT NULL
    AND customer_name != 'REDACTED';
  GET DIAGNOSTICS v_pii_anonymized = ROW_COUNT;

  -- Step 5: Purge old waiter calls
  DELETE FROM public.waiter_calls WHERE created_at < v_call_cutoff;
  GET DIAGNOSTICS v_calls_deleted = ROW_COUNT;

  -- Step 6: Purge old waste logs
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

-- Grant archive schema and function to service_role only
GRANT USAGE ON SCHEMA archive TO service_role;
GRANT ALL ON archive.orders TO service_role;
GRANT ALL ON archive.order_items TO service_role;
GRANT ALL ON archive.order_payments TO service_role;
GRANT EXECUTE ON FUNCTION public.run_data_retention(INT, INT, INT, INT) TO service_role;
