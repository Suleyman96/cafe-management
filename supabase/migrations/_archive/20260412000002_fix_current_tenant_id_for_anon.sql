-- Fix: current_tenant_id() returns NULL for anonymous users (customer-web).
-- The function only checked the staff table. Anonymous customers get their
-- tenant context via set_table_context() which sets a session variable.
-- This update checks the session variable first, then falls back to staff lookup.

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_tenant_id', true), '')::UUID,
    (SELECT tenant_id FROM public.staff WHERE auth_user_id = auth.uid() LIMIT 1)
  );
$$;
