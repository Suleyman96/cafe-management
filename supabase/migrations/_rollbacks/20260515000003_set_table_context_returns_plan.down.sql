-- Rollback: restore set_table_context(text) → uuid (the broken
-- shape that always paired with a stale-session-var
-- get_tenant_plan_from_context call from customer-web).
--
-- Only run this if reverting the customer-web client changes too —
-- the new client code expects the jsonb return shape.

DROP FUNCTION IF EXISTS public.set_table_context(text);

CREATE FUNCTION public.set_table_context(qr_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_table_id   uuid;
  v_tenant_id  uuid;
  v_revoked_at timestamptz;
  v_expires_at timestamptz;
BEGIN
  SELECT id, tenant_id, qr_code_revoked_at, qr_code_expires_at
    INTO v_table_id, v_tenant_id, v_revoked_at, v_expires_at
    FROM public.tables
   WHERE qr_code = qr_token;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'invalid_qr_token';
  END IF;

  IF v_revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'qr_token_revoked';
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at <= now() THEN
    RAISE EXCEPTION 'qr_token_expired';
  END IF;

  PERFORM set_config('app.qr_token', qr_token, true);
  PERFORM set_config('app.current_table_id', v_table_id::text, true);
  PERFORM set_config('app.current_tenant_id', v_tenant_id::text, true);

  RETURN v_tenant_id;
END;
$$;

ALTER FUNCTION public.set_table_context(text) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.set_table_context(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_table_context(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_table_context(text) TO anon;

-- Revert get_tenant_plan_from_context to the un-NULLIFed version.
CREATE OR REPLACE FUNCTION public.get_tenant_plan_from_context()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT t.plan FROM public.tenants t
   WHERE t.id = current_setting('app.current_tenant_id', true)::uuid;
$$;
