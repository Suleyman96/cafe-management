-- Rollback for C5 (20260429000002_plan_enforcement.sql).

DROP POLICY IF EXISTS plan_tasks_update ON public.tasks;
DROP POLICY IF EXISTS plan_tasks_insert ON public.tasks;
DROP POLICY IF EXISTS plan_schedules_update ON public.staff_schedules;
DROP POLICY IF EXISTS plan_schedules_insert ON public.staff_schedules;
DROP POLICY IF EXISTS plan_waste_update ON public.waste_logs;
DROP POLICY IF EXISTS plan_waste_insert ON public.waste_logs;
DROP POLICY IF EXISTS plan_inventory_items_update ON public.stock_items;
DROP POLICY IF EXISTS plan_inventory_items_insert ON public.stock_items;
DROP POLICY IF EXISTS plan_inventory_update ON public.stock_movements;
DROP POLICY IF EXISTS plan_inventory_insert ON public.stock_movements;

DROP FUNCTION IF EXISTS public.plan_allows_feature(text);
