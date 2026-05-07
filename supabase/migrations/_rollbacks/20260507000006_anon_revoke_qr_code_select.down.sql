-- Rollback for 20260507000006_anon_revoke_qr_code_select.sql.
--
-- Restores the pre-L4 state: anon has GRANT ALL on every column of
-- public.tables, and set_table_context() returns void. Use only if
-- the new return-type or column allowlist breaks an unanticipated
-- downstream consumer that can't be updated in time.

BEGIN;

-- 1. Restore the broad anon SELECT — this also covers all per-column
--    SELECT grants we added on the way in.
GRANT SELECT ON public.tables TO anon;

-- 2. Revert set_table_context(text) to RETURNS void (mirrors
--    20260507000003_table_qr_rotation.sql exactly).
DROP FUNCTION IF EXISTS public.set_table_context(text);

CREATE FUNCTION public.set_table_context(qr_token text)
RETURNS void
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
END;
$$;

ALTER FUNCTION public.set_table_context(text) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.set_table_context(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_table_context(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_table_context(text) TO anon;

COMMIT;
