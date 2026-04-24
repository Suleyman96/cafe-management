-- Auth hook: inject staff claims into JWT on token generation/refresh.
-- This eliminates per-request staff table lookups in middleware and API routes.
--
-- For production (hosted Supabase), enable via:
--   Dashboard > Auth > Hooks > Custom Access Token
--   Function: custom_access_token_hook

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql STABLE
SET search_path = ''
AS $$
DECLARE
  v_staff RECORD;
  claims JSONB;
BEGIN
  claims := event->'claims';

  SELECT id, tenant_id, role, is_active
  INTO v_staff
  FROM public.staff
  WHERE auth_user_id = (event->>'user_id')::UUID
    AND is_active = true
  LIMIT 1;

  IF v_staff IS NOT NULL THEN
    claims := jsonb_set(claims, '{staff_id}', to_jsonb(v_staff.id::TEXT));
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_staff.tenant_id::TEXT));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_staff.role::TEXT));
    claims := jsonb_set(claims, '{is_active_staff}', 'true'::JSONB);
  ELSE
    claims := jsonb_set(claims, '{is_active_staff}', 'false'::JSONB);
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(JSONB) TO supabase_auth_admin;
GRANT SELECT ON public.staff TO supabase_auth_admin;
