-- ============================================================
-- Post-audit Plan 1: idempotency on waiter_calls.acknowledge / resolve.
-- ============================================================
--
-- Goal: a second acknowledgement of an already-acknowledged call must NOT
-- overwrite the first responder. Same for resolve. UI surfaces a localized
-- "already answered by X" toast.
--
-- The wrapper writes responded_by + acknowledged_at on acknowledge, and
-- resolved_at + notes on resolve. Without a guard, two waiters who tap
-- "Answer" within the same MVCC window each succeed and the second
-- silently clobbers the first. RLS allows the write because both callers
-- have the same role.
--
-- Two guards layered:
--   1. Partial unique index on (tenant_id, *_client_request_id). A retry
--      with the same idempotency key trips 23505; the wrapper treats this
--      as a no-op replay and refetches the row. Mirrors the dedupe pattern
--      from migration 20260428000002.
--   2. BEFORE UPDATE trigger that rejects an UPDATE which would change
--      responded_by from a non-null value to a different non-null value
--      (likewise resolved_at). RAISE EXCEPTION uses ERRCODE = 'P0002'
--      with sentinel messages 'waiter_call_already_acknowledged' /
--      'waiter_call_already_resolved'. handleSupabaseError matches on the
--      message before the generic P0002 → NotFoundError fallback and
--      surfaces a ConflictError instead, which the staff-web safe hook
--      maps to the localized "already answered" toast.
--
-- Notes:
--   - Schema column is responded_by (not acknowledged_by); the existing
--     wrapper has used this name since baseline.
--   - Existing rows with responded_by already set are unaffected — the
--     trigger only fires on UPDATEs that *change* the column.
--   - Idempotent replay (same client_request_id from the same staff) goes
--     through the unique-index path and refetches the original row, so
--     React Query consumers see a successful response without a duplicate
--     write.

BEGIN;

ALTER TABLE public.waiter_calls
  ADD COLUMN IF NOT EXISTS acknowledged_client_request_id UUID,
  ADD COLUMN IF NOT EXISTS resolved_client_request_id UUID;

COMMENT ON COLUMN public.waiter_calls.acknowledged_client_request_id IS
  'Originating client_request_id of the acknowledge mutation. Partial unique on (tenant_id, acknowledged_client_request_id) so retries dedupe; trigger rejects cross-staff overwrites independently. NULL for rows acknowledged before 20260506000001.';

COMMENT ON COLUMN public.waiter_calls.resolved_client_request_id IS
  'Originating client_request_id of the resolve mutation. Same dedupe + guard semantics as acknowledged_client_request_id.';

CREATE UNIQUE INDEX IF NOT EXISTS waiter_calls_ack_dedupe
  ON public.waiter_calls (tenant_id, acknowledged_client_request_id)
  WHERE acknowledged_client_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS waiter_calls_resolve_dedupe
  ON public.waiter_calls (tenant_id, resolved_client_request_id)
  WHERE resolved_client_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_waiter_call_acknowledge()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  IF OLD.responded_by IS NOT NULL
     AND NEW.responded_by IS DISTINCT FROM OLD.responded_by THEN
    RAISE EXCEPTION 'waiter_call_already_acknowledged'
      USING ERRCODE = 'P0002';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_waiter_call_resolve()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  IF OLD.resolved_at IS NOT NULL
     AND NEW.resolved_at IS DISTINCT FROM OLD.resolved_at THEN
    RAISE EXCEPTION 'waiter_call_already_resolved'
      USING ERRCODE = 'P0002';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS waiter_calls_guard_ack ON public.waiter_calls;
CREATE TRIGGER waiter_calls_guard_ack
  BEFORE UPDATE OF responded_by ON public.waiter_calls
  FOR EACH ROW EXECUTE FUNCTION public.guard_waiter_call_acknowledge();

DROP TRIGGER IF EXISTS waiter_calls_guard_resolve ON public.waiter_calls;
CREATE TRIGGER waiter_calls_guard_resolve
  BEFORE UPDATE OF resolved_at ON public.waiter_calls
  FOR EACH ROW EXECUTE FUNCTION public.guard_waiter_call_resolve();

COMMIT;
