-- Migration: revoke default PUBLIC EXECUTE on adjust_stock_atomic.
--
-- Postgres grants EXECUTE-to-PUBLIC by default on newly-created functions.
-- The function trusts its p_tenant_id parameter because route handlers
-- have already authenticated and derived tenant via verifyPlan/verifyStaff.
-- That trust is broken if the function is reachable from a user-context
-- client where p_tenant_id is spoofable. REVOKE-from-PUBLIC is the
-- explicit-contract half; the paired GRANT lives in the next migration
-- file because the Supabase CLI's migration splitter rejects two
-- statements in a single file (SQLSTATE 42601).

REVOKE EXECUTE ON FUNCTION public.adjust_stock_atomic(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, UUID) FROM PUBLIC;
