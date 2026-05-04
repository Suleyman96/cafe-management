-- Rollback for 20260504000006_atomic_stock_adjust_lockdown.sql.
-- Restores the default per-role grants stripped by the forward migration.

DO $lockdown$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.adjust_stock_atomic(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, UUID) TO authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.adjust_stock_atomic(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, UUID) TO anon';
END
$lockdown$;
