-- ============================================================
-- Post-audit Plan 8: orders.version column for optimistic concurrency.
-- ============================================================
--
-- Problem: web + mobile concurrently mutating the same order silently
-- overwrite each other. Two waiters each tap "Mark Ready" on a stale view
-- and both UPDATEs succeed in MVCC; whichever lands second wins, with no
-- way for the client to detect the lost write.
--
-- Solution: every UPDATE bumps a monotonically-increasing version. Clients
-- pass the version they read; the wrapper appends `.eq('version', expected)`.
-- A mismatch updates zero rows and surfaces ConflictError('version_conflict').
-- The staff-web hook then refetches and either auto-recovers (kitchen
-- status moves) or opens an explicit Refresh / Override modal (refund,
-- close, cancel).
--
-- Design notes:
--   - INTEGER not BIGINT: 2.1B updates per row is far beyond any realistic
--     order lifecycle; a closed order stops mutating. INTEGER halves the
--     index footprint vs BIGINT and is the convention elsewhere.
--   - DEFAULT 1 NOT NULL: existing rows backfill to 1. The first UPDATE
--     after this migration deploys bumps to 2. Old clients (cached JS)
--     that don't yet send `expectedVersion` keep working — the wrapper
--     falls back to the existing UPDATE path. New clients with a stale
--     cache after deploy may see a single 409 once; refetch resolves it.
--   - BEFORE UPDATE trigger so the bump is visible inside any AFTER
--     triggers that fire on the same row (e.g. financial_audit_log,
--     update_table_status_on_order). A separate `update_orders_updated_at`
--     trigger already runs BEFORE UPDATE — both fire alphabetically; the
--     order doesn't matter since they touch different columns.
--   - WHEN clause skips the bump if the only changed column is `version`
--     itself, defending against any future code path that re-saves a row
--     unchanged: such a no-op shouldn't burn a version number.
--   - No RLS policy needed — the column inherits the table-level policies
--     on `orders`. The trigger uses SECURITY INVOKER (default) so it runs
--     under the writer's privileges, same as the existing updated_at
--     trigger.
--   - Realtime: the column is added to the row payload automatically;
--     subscribers see the bumped version on the next event without code
--     changes. Plan 10 (replay-since-checkpoint) reads `version` to
--     dedupe events.
--
-- Rollout: gated by feature flag `orders_optimistic_concurrency` per the
-- audit plan. Wrapper accepts `expectedVersion` regardless of flag — the
-- flag controls whether the staff-web hooks pass it. With the flag OFF,
-- behavior is identical to before this migration.

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.orders.version IS
  'Monotonic version bumped by bump_orders_version trigger on every meaningful UPDATE. Used by the wrapper for optimistic concurrency control: clients pass the version they read; mismatch surfaces ConflictError(version_conflict). See migration 20260506000004.';

CREATE OR REPLACE FUNCTION public.bump_orders_version()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  -- Skip the bump when no real columns changed. Postgres fires BEFORE
  -- UPDATE even on UPDATE ... SET col = col, and we don't want such a
  -- no-op to burn a version (clients holding the current version would
  -- see a spurious conflict). The version column is excluded from the
  -- equality check so a wrapper that explicitly writes the same version
  -- value still increments correctly.
  IF NEW.version IS NOT DISTINCT FROM OLD.version
     AND ROW(NEW.*) IS NOT DISTINCT FROM ROW(OLD.*) THEN
    RETURN NEW;
  END IF;

  NEW.version := COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bump_orders_version ON public.orders;
CREATE TRIGGER bump_orders_version
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_orders_version();

COMMIT;
