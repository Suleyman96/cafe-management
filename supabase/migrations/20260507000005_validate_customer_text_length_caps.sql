-- ============================================================
-- Finish H3. Promote PR #97's NOT VALID length CHECKs to fully
-- validated.
--
-- The 8 sibling constraints were added in 20260507000001 with NOT
-- VALID so the migration could ship without scanning historical
-- rows. The audit pre-flight (plans/18-...md §"Recommended PR
-- sequencing" item #2) ran:
--
--   SELECT count(*) FROM <table> WHERE length(<col>) > <cap>;
--
-- against the prod replica for all 8 (col, cap) pairs and returned
-- zero in every bucket — verified 2026-05-07. Validating now is
-- safe: Postgres scans each table once, finds no offending rows,
-- and flips the constraint's `convalidated` flag to true. After
-- this migration the constraint is fully enforced and `pg_dump`
-- emits it without the NOT VALID modifier.
--
-- Locking. ALTER TABLE … VALIDATE CONSTRAINT takes
-- SHARE UPDATE EXCLUSIVE on the table for the duration of the
-- scan. That permits SELECT, INSERT/UPDATE/DELETE, and the
-- existing realtime broadcasts to continue uninterrupted; only
-- other DDL is blocked. With per-tenant cardinalities currently
-- in the low millions and seq scan over a single column, each
-- VALIDATE completes in well under a second.
--
-- Idempotency. Re-running VALIDATE on an already-validated
-- constraint is a no-op in Postgres, so this migration is safe
-- to apply against any prod state where the NOT VALID predecessor
-- has been applied.
-- ============================================================

BEGIN;

-- orders ------------------------------------------------------------

ALTER TABLE public.orders
  VALIDATE CONSTRAINT orders_customer_notes_length_check;
ALTER TABLE public.orders
  VALIDATE CONSTRAINT orders_delivery_address_length_check;
ALTER TABLE public.orders
  VALIDATE CONSTRAINT orders_delivery_notes_length_check;
ALTER TABLE public.orders
  VALIDATE CONSTRAINT orders_internal_notes_length_check;

-- order_items -------------------------------------------------------

ALTER TABLE public.order_items
  VALIDATE CONSTRAINT order_items_notes_length_check;

-- customer_feedback -------------------------------------------------

ALTER TABLE public.customer_feedback
  VALIDATE CONSTRAINT customer_feedback_message_length_check;
ALTER TABLE public.customer_feedback
  VALIDATE CONSTRAINT customer_feedback_response_length_check;

-- waiter_calls ------------------------------------------------------

ALTER TABLE public.waiter_calls
  VALIDATE CONSTRAINT waiter_calls_notes_length_check;

COMMIT;
