-- Rollback for 20260506000004_orders_version_etag.sql.
-- Drops the trigger and bump function, then drops the version column.
-- Unlike the *_client_request_id columns elsewhere, version is purely a
-- concurrency token — no audit value in keeping the data, and clients
-- rolled back will not know what to do with it. Always drop.

BEGIN;

DROP TRIGGER IF EXISTS bump_orders_version ON public.orders;
DROP FUNCTION IF EXISTS public.bump_orders_version();

ALTER TABLE public.orders DROP COLUMN IF EXISTS version;

COMMIT;
