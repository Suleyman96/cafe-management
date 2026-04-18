-- Composite indexes for multi-column query patterns not covered by existing indexes.
-- Existing single-column indexes: tenant_id, status, date columns (see baseline).
-- Existing composites: orders(tenant_id, status, created_at), order_items(order_id, status),
--   tasks(assigned_to, status), staff_schedules(staff_id, date).

-- Waiter calls: dashboard fetches pending calls scoped to tenant
-- Covers: SELECT * FROM waiter_calls WHERE tenant_id = X AND status = 'pending' ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_waiter_calls_tenant_status
  ON waiter_calls (tenant_id, status, created_at DESC);

-- Expenses: date-range reports scoped to tenant
-- Covers: SELECT * FROM expenses WHERE tenant_id = X AND expense_date BETWEEN ... ORDER BY expense_date DESC
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date
  ON expenses (tenant_id, expense_date DESC);

-- Waste logs: date-range reports scoped to tenant
-- Covers: SELECT * FROM waste_logs WHERE tenant_id = X AND waste_date BETWEEN ... ORDER BY waste_date DESC
CREATE INDEX IF NOT EXISTS idx_waste_logs_tenant_date
  ON waste_logs (tenant_id, waste_date DESC);

-- Orders: delivery and takeout filtered views
-- Covers: SELECT * FROM orders WHERE tenant_id = X AND order_type = 'delivery' AND status != 'closed'
CREATE INDEX IF NOT EXISTS idx_orders_tenant_type_status
  ON orders (tenant_id, order_type, status);

-- Tasks: overdue task queries filter by tenant + status + due_date
-- Covers: SELECT * FROM tasks WHERE tenant_id = X AND status IN (...) AND due_date <= NOW()
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status_due
  ON tasks (tenant_id, status, due_date);

-- Orders: active order lookup for a specific table (customer-web, table page)
-- Partial index — only indexes non-terminal orders, much smaller than full table
CREATE INDEX IF NOT EXISTS idx_orders_table_active
  ON orders (table_id, status)
  WHERE status NOT IN ('closed', 'cancelled');
