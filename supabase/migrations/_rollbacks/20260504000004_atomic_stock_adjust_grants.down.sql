-- Rollback for 20260504000004_atomic_stock_adjust_grants.sql.
-- Restoring the default PUBLIC grant. (Note: only takes effect while the
-- function still exists; the function-drop in the 20260504000003 rollback
-- removes the grant target entirely.)

GRANT EXECUTE ON FUNCTION public.adjust_stock_atomic(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, UUID) TO PUBLIC;
