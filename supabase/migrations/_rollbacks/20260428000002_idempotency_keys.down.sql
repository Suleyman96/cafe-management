-- Rollback for 20260428000002_idempotency_keys.
--
-- Drop indexes first (CONCURRENTLY, outside any transaction block),
-- then drop columns. Rows that already shipped a client_request_id
-- value will lose it — that's fine: the value is only useful for
-- dedupe at insert time, never read afterwards.

DROP INDEX CONCURRENTLY IF EXISTS public.orders_tenant_client_request_id_uidx;
DROP INDEX CONCURRENTLY IF EXISTS public.order_items_tenant_client_request_id_uidx;
DROP INDEX CONCURRENTLY IF EXISTS public.order_payments_tenant_client_request_id_uidx;
DROP INDEX CONCURRENTLY IF EXISTS public.refunds_tenant_client_request_id_uidx;
DROP INDEX CONCURRENTLY IF EXISTS public.stock_movements_tenant_client_request_id_uidx;
DROP INDEX CONCURRENTLY IF EXISTS public.waiter_calls_tenant_client_request_id_uidx;
DROP INDEX CONCURRENTLY IF EXISTS public.tasks_tenant_client_request_id_uidx;
DROP INDEX CONCURRENTLY IF EXISTS public.expenses_tenant_client_request_id_uidx;

ALTER TABLE public.orders          DROP COLUMN IF EXISTS client_request_id;
ALTER TABLE public.order_items     DROP COLUMN IF EXISTS client_request_id;
ALTER TABLE public.order_payments  DROP COLUMN IF EXISTS client_request_id;
ALTER TABLE public.refunds         DROP COLUMN IF EXISTS client_request_id;
ALTER TABLE public.stock_movements DROP COLUMN IF EXISTS client_request_id;
ALTER TABLE public.waiter_calls    DROP COLUMN IF EXISTS client_request_id;
ALTER TABLE public.tasks           DROP COLUMN IF EXISTS client_request_id;
ALTER TABLE public.expenses        DROP COLUMN IF EXISTS client_request_id;
