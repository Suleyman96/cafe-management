-- Rollback: restore the dead `anon_read_via_context` policy and the
-- orphan `get_tenant_plan_from_context()` function. Restored to the
-- last known shapes (the NULLIF-hardened versions from
-- 20260515000003). Functionally still broken — the session var they
-- depend on doesn't survive a PostgREST transaction commit — but
-- syntactically what was removed.
--
-- Only run if a downstream consumer turns out to reach either object
-- by name (unlikely; grep showed no callers at drop time).

CREATE POLICY "anon_read_via_context" ON public.order_payments
  FOR SELECT TO anon
  USING (
    (tenant_id::text = current_setting('app.current_tenant_id', true))
  );

CREATE OR REPLACE FUNCTION public.get_tenant_plan_from_context()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT t.plan FROM public.tenants t
   WHERE t.id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$;

REVOKE EXECUTE ON FUNCTION public.get_tenant_plan_from_context() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_tenant_plan_from_context() TO anon, authenticated, service_role;
