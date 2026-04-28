-- ============================================================
-- C1. Idempotency keys for replayable mutations
--
-- Mobile persists paused mutations to MMKV and replays them on
-- relaunch. Without a server-side dedupe key, a mutation that
-- committed but lost its response will create a duplicate row on
-- replay (duplicate orders, double payments, etc.).
--
-- Each replayable insert now carries a client-generated UUID.
-- The unique index on (tenant_id, client_request_id) makes the
-- INSERT idempotent: a second attempt with the same key violates
-- the constraint, callers swallow the conflict and re-SELECT the
-- original row.
--
-- Column is nullable: legacy rows and server-originated inserts
-- (web staff dashboard, customer web) can still write without a
-- key. Partial-unique index ignores NULLs so this stays safe.
--
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction
-- block. This migration intentionally has no BEGIN/COMMIT.
-- ============================================================

-- Add nullable column to each replay-target table.
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS is idempotent.

ALTER TABLE public.orders          ADD COLUMN IF NOT EXISTS client_request_id uuid;
ALTER TABLE public.order_items     ADD COLUMN IF NOT EXISTS client_request_id uuid;
ALTER TABLE public.order_payments  ADD COLUMN IF NOT EXISTS client_request_id uuid;
ALTER TABLE public.refunds         ADD COLUMN IF NOT EXISTS client_request_id uuid;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS client_request_id uuid;
ALTER TABLE public.waiter_calls    ADD COLUMN IF NOT EXISTS client_request_id uuid;
ALTER TABLE public.tasks           ADD COLUMN IF NOT EXISTS client_request_id uuid;
ALTER TABLE public.expenses        ADD COLUMN IF NOT EXISTS client_request_id uuid;

-- Partial unique indexes scoped to (tenant_id, client_request_id).
-- WHERE client_request_id IS NOT NULL keeps NULL rows unconstrained,
-- so existing data and server-originated inserts continue to work.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS orders_tenant_client_request_id_uidx
  ON public.orders (tenant_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS order_items_tenant_client_request_id_uidx
  ON public.order_items (tenant_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS order_payments_tenant_client_request_id_uidx
  ON public.order_payments (tenant_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS refunds_tenant_client_request_id_uidx
  ON public.refunds (tenant_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS stock_movements_tenant_client_request_id_uidx
  ON public.stock_movements (tenant_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS waiter_calls_tenant_client_request_id_uidx
  ON public.waiter_calls (tenant_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS tasks_tenant_client_request_id_uidx
  ON public.tasks (tenant_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS expenses_tenant_client_request_id_uidx
  ON public.expenses (tenant_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

COMMENT ON COLUMN public.orders.client_request_id          IS 'Client-generated UUID for idempotent replay. See migration 20260428000002.';
COMMENT ON COLUMN public.order_items.client_request_id     IS 'Client-generated UUID for idempotent replay. See migration 20260428000002.';
COMMENT ON COLUMN public.order_payments.client_request_id  IS 'Client-generated UUID for idempotent replay. See migration 20260428000002.';
COMMENT ON COLUMN public.refunds.client_request_id         IS 'Client-generated UUID for idempotent replay. See migration 20260428000002.';
COMMENT ON COLUMN public.stock_movements.client_request_id IS 'Client-generated UUID for idempotent replay. See migration 20260428000002.';
COMMENT ON COLUMN public.waiter_calls.client_request_id    IS 'Client-generated UUID for idempotent replay. See migration 20260428000002.';
COMMENT ON COLUMN public.tasks.client_request_id           IS 'Client-generated UUID for idempotent replay. See migration 20260428000002.';
COMMENT ON COLUMN public.expenses.client_request_id        IS 'Client-generated UUID for idempotent replay. See migration 20260428000002.';
