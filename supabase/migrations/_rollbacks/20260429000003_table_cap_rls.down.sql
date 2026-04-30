DROP POLICY IF EXISTS plan_tables_insert ON public.tables;
DROP FUNCTION IF EXISTS public.plan_allows_new_table(uuid);
