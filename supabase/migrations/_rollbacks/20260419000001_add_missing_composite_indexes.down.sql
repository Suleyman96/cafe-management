-- Rollback: remove composite indexes added in Phase 2
DROP INDEX IF EXISTS idx_waiter_calls_tenant_status;
DROP INDEX IF EXISTS idx_expenses_tenant_date;
DROP INDEX IF EXISTS idx_waste_logs_tenant_date;
DROP INDEX IF EXISTS idx_orders_tenant_type_status;
DROP INDEX IF EXISTS idx_tasks_tenant_status_due;
DROP INDEX IF EXISTS idx_orders_table_active;
