-- Migration: grant EXECUTE on adjust_stock_atomic to service_role.
--
-- Paired follow-up to 20260504000004_atomic_stock_adjust_grants.sql, which
-- revoked the default PUBLIC grant. The route handler uses the service-role
-- client (`getSupabaseAdmin()`), which is the only client that should be
-- able to invoke this function. Split into its own file so the Supabase
-- CLI migration splitter parses each statement as a single prepared
-- statement (avoids SQLSTATE 42601).

GRANT EXECUTE ON FUNCTION public.adjust_stock_atomic(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, UUID) TO service_role;
