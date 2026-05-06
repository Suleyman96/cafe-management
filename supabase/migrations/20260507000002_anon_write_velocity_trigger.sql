-- ============================================================
-- H1. Velocity-guard triggers on waiter_calls and customer_feedback.
--
-- The pre-PR3 path let an attacker holding a single QR code spam the
-- kitchen with thousands of pending waiter calls per minute by hitting
-- Supabase directly with the public anon key — the Upstash limiter on
-- the staff-web edge couldn't help because the wrapper bypassed the
-- API route entirely.
--
-- PR3 moves customer-web through `/api/v1/customer/waiter-calls` and
-- `/api/v1/customer/feedback`, where the Upstash limiter gates the
-- request rate (5 / 60s per IP for waiter calls; 3 / 300s for
-- feedback). These DB triggers are the second line of defense for any
-- caller that bypasses those routes — a forked customer-web build, a
-- bare `curl`, a server-side script with the anon key, or a future
-- code path that goes back through the wrapper.
--
-- Limits are deliberately generous so a real busy-table burst doesn't
-- trip them; anything past these numbers is unambiguous abuse:
--
--   - waiter_calls: 10 INSERTs in 60 s for the same (tenant_id, table_id)
--   - customer_feedback: 5 INSERTs in 5 min for the same (tenant_id, table_id)
--
-- Limits are PER-TABLE (not per-tenant) — a busy restaurant might have
-- 50 tables each calling the waiter, but no single table should issue
-- 10 calls in 60 s under any legitimate scenario. Per-tenant aggregate
-- limits would require a separate `tenants_aggregate_velocity` shape
-- and aren't worth the complexity.
--
-- The trigger raises the existing `'rate_limited'` sentinel
-- (SENTINEL_ERROR_CODES in `packages/i18n/src/error-keys.ts`) so client
-- consumers see a localized "Too many requests" message via
-- `localizeErrorMessage`, matching the UX of an Upstash 429.
--
-- Indexes: the predicate hits `(table_id, created_at DESC)` for both
-- tables. CREATE INDEX IF NOT EXISTS so a re-run is a no-op. Not
-- CONCURRENTLY because these tables are small and the trigger needs a
-- usable index from the moment it's installed.
-- ============================================================

BEGIN;

-- ── waiter_calls ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_waiter_calls_table_id_created_at
  ON public.waiter_calls (table_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_waiter_call_velocity()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*)
    INTO v_count
    FROM public.waiter_calls
   WHERE table_id = NEW.table_id
     AND created_at > now() - interval '1 minute';

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.guard_waiter_call_velocity() OWNER TO postgres;

DROP TRIGGER IF EXISTS waiter_calls_velocity_guard ON public.waiter_calls;
CREATE TRIGGER waiter_calls_velocity_guard
  BEFORE INSERT ON public.waiter_calls
  FOR EACH ROW EXECUTE FUNCTION public.guard_waiter_call_velocity();

-- ── customer_feedback ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_customer_feedback_table_id_created_at
  ON public.customer_feedback (table_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_customer_feedback_velocity()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*)
    INTO v_count
    FROM public.customer_feedback
   WHERE table_id = NEW.table_id
     AND created_at > now() - interval '5 minutes';

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.guard_customer_feedback_velocity() OWNER TO postgres;

DROP TRIGGER IF EXISTS customer_feedback_velocity_guard ON public.customer_feedback;
CREATE TRIGGER customer_feedback_velocity_guard
  BEFORE INSERT ON public.customer_feedback
  FOR EACH ROW EXECUTE FUNCTION public.guard_customer_feedback_velocity();

COMMIT;
