-- ============================================================
-- S4. Idempotency key for customer_feedback
--
-- Mirror of the pattern in 20260428000002_idempotency_keys.sql:
-- a customer who taps "Submit feedback" twice (rage-tap, double-
-- fire on a flaky network, mutation retry) would otherwise produce
-- two identical complaint rows in the staff queue. The Upstash
-- limiter on `/api/v1/customer/feedback` (3 / 5 min / IP) caps the
-- worst case, but within that window a duplicate still lands.
--
-- Column is nullable: legacy feedback rows (pre-migration) carry
-- NULL, and the partial unique index ignores NULLs so the existing
-- data and any future internal callers that don't have a key still
-- write fine. The route schema marks the field required, so live
-- traffic always carries an id.
-- ============================================================

ALTER TABLE public.customer_feedback ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS customer_feedback_tenant_client_request_id_uidx
  ON public.customer_feedback (tenant_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

COMMENT ON COLUMN public.customer_feedback.client_request_id
  IS 'Client-generated UUID for idempotent replay. See migration 20260517000001.';
