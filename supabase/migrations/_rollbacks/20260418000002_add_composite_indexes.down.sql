-- Rollback: remove composite indexes added in 20260418000002
DROP INDEX IF EXISTS idx_orders_tenant_status;
DROP INDEX IF EXISTS idx_order_items_order_status;
DROP INDEX IF EXISTS idx_tasks_assigned_status;
DROP INDEX IF EXISTS idx_staff_schedules_staff_date;
