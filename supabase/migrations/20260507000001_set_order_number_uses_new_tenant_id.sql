-- ============================================================
-- Fix: set_order_number BEFORE INSERT trigger should derive the
-- per-tenant counter from NEW.tenant_id, not from current_tenant_id().
--
-- Background: 20260430000002_multitenant_security_hardening.sql made
-- generate_order_number() raise when current_tenant_id() returns NULL.
-- That breaks the staff-web order-create route, which performs the
-- insert via the service-role admin client (no auth.uid(), no
-- app.current_tenant_id GUC), even though the inserted row already
-- carries the verified tenant_id from verifyStaff().
--
-- Defense-in-depth is preserved:
--   - orders.tenant_id is NOT NULL.
--   - RLS on orders prevents authenticated users from inserting a
--     row whose tenant_id ≠ current_tenant_id().
--   - Service-role inserts originate in /api/v1/orders, which derives
--     the tenant_id from the verified staff record before the call.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_order_number() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = ''
AS $$
DECLARE
  counter INTEGER;
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    SELECT COUNT(*) INTO counter
      FROM public.orders
     WHERE tenant_id = NEW.tenant_id
       AND DATE(created_at) = CURRENT_DATE;

    NEW.order_number := 'ORD'
      || TO_CHAR(CURRENT_DATE, 'YYMMDD')
      || LPAD((counter + 1)::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;
