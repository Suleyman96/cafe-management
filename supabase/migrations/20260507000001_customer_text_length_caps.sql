-- ============================================================
-- H3. Length caps on customer-facing free-text columns.
--
-- Without these caps a customer can POST a 50 MB `customer_notes`
-- (or any other free-text field) and watch it land in the database,
-- broadcast through Supabase Realtime to every staff device on the
-- channel, and replicate to the audit log path. Storage cost balloons,
-- realtime fanout amplifies the payload, and a single attacker behind
-- a randomized header set bypasses the per-IP Upstash limiter.
--
-- The Zod schemas on `/api/v1/customer/orders*` reject oversized
-- payloads at the edge. These constraints are the second line of
-- defense for two paths Zod can't cover:
--
--   1. `db.feedback.create` and `db.waiterCalls.create` go through
--      `@gustri/api-client` directly — no API route, no Zod.
--   2. Any future code path that bypasses the route (a forked client,
--      a server-side script using `supabaseAdmin`, etc.).
--
-- Why NOT VALID. These columns historically had no cap; the row
-- distribution in older tenants is unknown. NOT VALID enforces the
-- constraint on every write going forward without scanning existing
-- rows, so the migration can't fail on legacy data and acquires only a
-- short ACCESS EXCLUSIVE lock. A follow-up migration can run
-- `VALIDATE CONSTRAINT` once a per-tenant cleanup pass confirms no
-- rows exceed the caps. The varchar-typed customer-facing columns
-- (`customer_name`, `customer_phone`, `item_name`, `waiter_calls.reason`)
-- are intentionally NOT included here — Postgres already enforces
-- their length via the column type, and adding redundant CHECKs would
-- only obscure the type-level guarantee.
--
-- Limits mirror the staff-side `OrderCreateInputSchema` and
-- `OrderPaymentCreateInputSchema` in
-- `packages/database/src/schemas/inputs.ts`, so a row that survives
-- the customer-web path also survives staff edits.
-- ============================================================

BEGIN;

-- orders ------------------------------------------------------------

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_customer_notes_length_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_customer_notes_length_check
  CHECK (customer_notes IS NULL OR length(customer_notes) <= 2000)
  NOT VALID;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_delivery_address_length_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_address_length_check
  CHECK (delivery_address IS NULL OR length(delivery_address) <= 500)
  NOT VALID;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_delivery_notes_length_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_notes_length_check
  CHECK (delivery_notes IS NULL OR length(delivery_notes) <= 2000)
  NOT VALID;

-- internal_notes is staff-only but unbounded today — same DoS shape if
-- a compromised staff session writes a giant blob.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_internal_notes_length_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_internal_notes_length_check
  CHECK (internal_notes IS NULL OR length(internal_notes) <= 2000)
  NOT VALID;

-- order_items -------------------------------------------------------

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_notes_length_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_notes_length_check
  CHECK (notes IS NULL OR length(notes) <= 500)
  NOT VALID;

-- customer_feedback -------------------------------------------------

-- `message` is NOT NULL on this table, so the check is unconditional.
-- The cap is generous (1000 chars ≈ a long paragraph) and matches the
-- HTML5 `maxLength` already on the customer-web textarea.
ALTER TABLE public.customer_feedback
  DROP CONSTRAINT IF EXISTS customer_feedback_message_length_check;
ALTER TABLE public.customer_feedback
  ADD CONSTRAINT customer_feedback_message_length_check
  CHECK (length(message) <= 1000)
  NOT VALID;

-- Staff response is bounded for symmetry — also user-typed.
ALTER TABLE public.customer_feedback
  DROP CONSTRAINT IF EXISTS customer_feedback_response_length_check;
ALTER TABLE public.customer_feedback
  ADD CONSTRAINT customer_feedback_response_length_check
  CHECK (response IS NULL OR length(response) <= 2000)
  NOT VALID;

-- waiter_calls ------------------------------------------------------

ALTER TABLE public.waiter_calls
  DROP CONSTRAINT IF EXISTS waiter_calls_notes_length_check;
ALTER TABLE public.waiter_calls
  ADD CONSTRAINT waiter_calls_notes_length_check
  CHECK (notes IS NULL OR length(notes) <= 500)
  NOT VALID;

COMMIT;
