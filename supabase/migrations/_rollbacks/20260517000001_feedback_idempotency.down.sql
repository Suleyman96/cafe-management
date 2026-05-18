-- Rollback for 20260517000001_feedback_idempotency.
--
-- Drop the index first (CONCURRENTLY, outside any transaction block),
-- then drop the column. Rows that already shipped a client_request_id
-- value will lose it — that's fine: the value is only useful for
-- dedupe at insert time, never read afterwards.

DROP INDEX CONCURRENTLY IF EXISTS public.customer_feedback_tenant_client_request_id_uidx;

ALTER TABLE public.customer_feedback DROP COLUMN IF EXISTS client_request_id;
