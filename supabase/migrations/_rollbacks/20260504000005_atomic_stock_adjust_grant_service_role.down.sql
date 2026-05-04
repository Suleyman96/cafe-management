-- Rollback for 20260504000005_atomic_stock_adjust_grant_service_role.sql.

REVOKE EXECUTE ON FUNCTION public.adjust_stock_atomic(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, UUID) FROM service_role;
