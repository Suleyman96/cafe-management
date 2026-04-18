-- Composite indexes for high-frequency multi-column queries
-- These replace inefficient filter-scans on existing single-column indexes

-- Orders: tenant-scoped dashboard queries filter by (tenant_id, status)
-- Includes created_at DESC for sort-order coverage (avoids separate sort step)
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status
  ON orders (tenant_id, status, created_at DESC);

-- Order items: kitchen display queries filter items by order + status
-- Critical for KDS page performance at scale
CREATE INDEX IF NOT EXISTS idx_order_items_order_status
  ON order_items (order_id, status);

-- Tasks: staff task dashboards filter by assignee + status
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status
  ON tasks (assigned_to, status);

-- Staff schedules: schedule lookups filter by staff member + date
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_date
  ON staff_schedules (staff_id, date);
