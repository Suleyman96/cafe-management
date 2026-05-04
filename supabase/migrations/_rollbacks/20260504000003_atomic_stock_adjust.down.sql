-- Rollback for 20260504000003_atomic_stock_adjust.sql.
-- Drops the atomic adjust_stock_atomic RPC. The service still has the
-- pre-RPC code path in git history if a revert ships; the route + service
-- must be reverted in lockstep, otherwise the route call will 4xx with
-- "function does not exist".

DROP FUNCTION IF EXISTS public.adjust_stock_atomic(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, UUID);
